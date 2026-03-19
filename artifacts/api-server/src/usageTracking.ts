import { isDbEnabled } from "./localDev";

export type UsageEventType =
  | "terminal_open"
  | "mission_control_open"
  | "gateway_toggle"
  | "settings_sync"
  | "whatsapp_qr_start";

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

const localEvents = new Map<string, UsageEvent[]>();
const dedupeState = new Map<string, number>();
const LOCAL_EVENT_LIMIT_PER_USER = 500;
const DEDUPE_WINDOW_MS = 45_000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function shouldSkipByDedupe(email: string, type: UsageEventType): boolean {
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
