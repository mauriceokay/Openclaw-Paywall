import { isDbEnabled } from "./localDev";

export type UsageEventType =
  | "terminal_open"
  | "mission_control_open"
  | "gateway_toggle"
  | "settings_sync"
  | "whatsapp_qr_start"
  | "token_usage";

type UsageEventMetadata = Record<string, unknown>;

type UsageEvent = {
  type: UsageEventType;
  createdAt: string;
  metadata: UsageEventMetadata;
};

type UsageEventSummary = {
  total: number;
  byType: Record<string, number>;
  recent: Array<{ type: UsageEventType; createdAt: string }>;
};

export type TokenUsageSummary = {
  totalTokens: number;
  weightedTokens: number;
  estimatedCostUsd: number;
  byProvider: Record<string, { events: number; totalTokens: number; weightedTokens: number; estimatedCostUsd: number }>;
};

const localEvents = new Map<string, UsageEvent[]>();
const dedupeState = new Map<string, number>();
const LOCAL_EVENT_LIMIT_PER_USER = 500;
const DEDUPE_WINDOW_MS = 45_000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function shouldSkipByDedupe(email: string, type: UsageEventType): boolean {
  // Token usage events are high-frequency billing records and must not be deduped.
  if (type === "token_usage") return false;

  const key = `${email}:${type}`;
  const now = Date.now();
  const previous = dedupeState.get(key);
  if (typeof previous === "number" && now - previous < DEDUPE_WINDOW_MS) {
    return true;
  }
  dedupeState.set(key, now);
  return false;
}

function recordLocalEvent(email: string, type: UsageEventType, metadata: UsageEventMetadata): void {
  const events = localEvents.get(email) ?? [];
  events.unshift({
    type,
    createdAt: new Date().toISOString(),
    metadata,
  });
  if (events.length > LOCAL_EVENT_LIMIT_PER_USER) {
    events.length = LOCAL_EVENT_LIMIT_PER_USER;
  }
  localEvents.set(email, events);
}

export async function trackUsageEvent(
  email: string,
  type: UsageEventType,
  metadata: UsageEventMetadata = {},
): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || shouldSkipByDedupe(normalizedEmail, type)) {
    return;
  }

  if (!isDbEnabled()) {
    recordLocalEvent(normalizedEmail, type, metadata);
    return;
  }

  try {
    const { pool } = await import("@workspace/db");
    await pool.query(
      `INSERT INTO app.usage_events (email, type, metadata) VALUES ($1, $2, $3::jsonb)`,
      [normalizedEmail, type, JSON.stringify(metadata)],
    );
  } catch (err) {
    // Keep local fallback so usage still appears in dev/runtime issues.
    recordLocalEvent(normalizedEmail, type, metadata);
    console.error("[usage-tracking] failed to write DB event:", err);
  }
}

export async function getUsageEventSummary(email: string): Promise<UsageEventSummary> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { total: 0, byType: {}, recent: [] };
  }

  if (!isDbEnabled()) {
    const events = localEvents.get(normalizedEmail) ?? [];
    const byType: Record<string, number> = {};
    for (const event of events) {
      byType[event.type] = (byType[event.type] ?? 0) + 1;
    }
    return {
      total: events.length,
      byType,
      recent: events.slice(0, 20).map((event) => ({
        type: event.type,
        createdAt: event.createdAt,
      })),
    };
  }

  try {
    const { pool } = await import("@workspace/db");
    const grouped = await pool.query(
      `SELECT type, COUNT(*)::int AS count
       FROM app.usage_events
       WHERE email = $1
         AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY type`,
      [normalizedEmail],
    );
    const recent = await pool.query(
      `SELECT type, created_at
       FROM app.usage_events
       WHERE email = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [normalizedEmail],
    );

    const byType: Record<string, number> = {};
    let total = 0;

    for (const row of grouped.rows as Array<{ type: string; count: number | string }>) {
      const count = typeof row.count === "number" ? row.count : Number(row.count);
      const safeCount = Number.isFinite(count) ? count : 0;
      byType[row.type] = safeCount;
      total += safeCount;
    }

    return {
      total,
      byType,
      recent: (recent.rows as Array<{ type: UsageEventType; created_at: string | Date }>).map((row) => ({
        type: row.type,
        createdAt:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : new Date(row.created_at).toISOString(),
      })),
    };
  } catch (err) {
    console.error("[usage-tracking] failed to read DB events:", err);
    return { total: 0, byType: {}, recent: [] };
  }
}

export async function getTokenUsageSummary(email: string): Promise<TokenUsageSummary> {
  const normalizedEmail = normalizeEmail(email);
  const empty: TokenUsageSummary = {
    totalTokens: 0,
    weightedTokens: 0,
    estimatedCostUsd: 0,
    byProvider: {},
  };

  if (!normalizedEmail) {
    return empty;
  }

  if (!isDbEnabled()) {
    const events = localEvents.get(normalizedEmail) ?? [];
    const byProvider: TokenUsageSummary["byProvider"] = {};

    for (const event of events) {
      if (event.type !== "token_usage") continue;
      const provider = String(event.metadata.provider ?? "unknown").trim().toLowerCase() || "unknown";
      const totalTokens = Number(event.metadata.totalTokens ?? 0);
      const weightedTokens = Number(event.metadata.weightedTokens ?? 0);
      const estimatedCostUsd = Number(event.metadata.estimatedCostUsd ?? 0);

      if (!byProvider[provider]) {
        byProvider[provider] = { events: 0, totalTokens: 0, weightedTokens: 0, estimatedCostUsd: 0 };
      }
      byProvider[provider].events += 1;
      byProvider[provider].totalTokens += Number.isFinite(totalTokens) ? totalTokens : 0;
      byProvider[provider].weightedTokens += Number.isFinite(weightedTokens) ? weightedTokens : 0;
      byProvider[provider].estimatedCostUsd += Number.isFinite(estimatedCostUsd) ? estimatedCostUsd : 0;
    }

    return {
      totalTokens: Object.values(byProvider).reduce((sum, item) => sum + item.totalTokens, 0),
      weightedTokens: Object.values(byProvider).reduce((sum, item) => sum + item.weightedTokens, 0),
      estimatedCostUsd: Number(
        Object.values(byProvider).reduce((sum, item) => sum + item.estimatedCostUsd, 0).toFixed(6),
      ),
      byProvider,
    };
  }

  try {
    const { pool } = await import("@workspace/db");
    const result = await pool.query(
      `SELECT
         COALESCE(metadata->>'provider', 'unknown') AS provider,
         COUNT(*)::int AS events,
         COALESCE(SUM((metadata->>'totalTokens')::numeric), 0) AS total_tokens,
         COALESCE(SUM((metadata->>'weightedTokens')::numeric), 0) AS weighted_tokens,
         COALESCE(SUM((metadata->>'estimatedCostUsd')::numeric), 0) AS estimated_cost_usd
       FROM app.usage_events
       WHERE email = $1
         AND type = 'token_usage'
         AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY 1`,
      [normalizedEmail],
    );

    const byProvider: TokenUsageSummary["byProvider"] = {};
    for (const row of result.rows as Array<{
      provider: string;
      events: number | string;
      total_tokens: number | string;
      weighted_tokens: number | string;
      estimated_cost_usd: number | string;
    }>) {
      const provider = String(row.provider || "unknown").toLowerCase();
      const events = Number(row.events ?? 0);
      const totalTokens = Number(row.total_tokens ?? 0);
      const weightedTokens = Number(row.weighted_tokens ?? 0);
      const estimatedCostUsd = Number(row.estimated_cost_usd ?? 0);
      byProvider[provider] = {
        events: Number.isFinite(events) ? events : 0,
        totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0,
        weightedTokens: Number.isFinite(weightedTokens) ? weightedTokens : 0,
        estimatedCostUsd: Number.isFinite(estimatedCostUsd) ? estimatedCostUsd : 0,
      };
    }

    return {
      totalTokens: Object.values(byProvider).reduce((sum, item) => sum + item.totalTokens, 0),
      weightedTokens: Object.values(byProvider).reduce((sum, item) => sum + item.weightedTokens, 0),
      estimatedCostUsd: Number(
        Object.values(byProvider).reduce((sum, item) => sum + item.estimatedCostUsd, 0).toFixed(6),
      ),
      byProvider,
    };
  } catch (err) {
    console.error("[usage-tracking] failed to read token usage summary:", err);
    return empty;
  }
}
