import { readFileSync } from "fs";
import path from "path";
import { Router } from "express";
import { getSessionEmail } from "../sessionAuth";
import { trackUsageEvent } from "../usageTracking";

const router = Router();
const MISSION_CONTROL_BACKEND_URL = (process.env.MISSION_CONTROL_BACKEND_URL ?? "http://127.0.0.1:8001").replace(/\/+$/, "");
const DEFAULT_SKILL_PACK_URL = "https://github.com/openclaw/openclaw";
const DEFAULT_MARKETPLACE_LIMIT = 100;

function toGatewayWsUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "ws://gateway:3005";
  if (/^wss?:\/\//i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");
  }
  return trimmed;
}

async function ensureMarketplaceSeed(headers: Record<string, string>, gatewayId: string): Promise<void> {
  const marketplaceProbe = await fetch(
    `${MISSION_CONTROL_BACKEND_URL}/api/v1/skills/marketplace?gateway_id=${encodeURIComponent(gatewayId)}&limit=1`,
    { headers },
  );
  if (!marketplaceProbe.ok) return;
  const existingCardsPayload = (await marketplaceProbe.json()) as unknown;
  const existingCards = Array.isArray(existingCardsPayload)
    ? existingCardsPayload
    : (typeof existingCardsPayload === "object" && existingCardsPayload !== null && Array.isArray((existingCardsPayload as { items?: unknown[] }).items)
      ? (existingCardsPayload as { items: unknown[] }).items
      : []);
  if (existingCards.length > 0) return;

  const packsRes = await fetch(`${MISSION_CONTROL_BACKEND_URL}/api/v1/skills/packs`, { headers });
  if (!packsRes.ok) return;
  const packsPayload = (await packsRes.json()) as unknown;
  const packs = Array.isArray(packsPayload)
    ? (packsPayload as Array<{ id?: string; source_url?: string }>)
    : (typeof packsPayload === "object" && packsPayload !== null && Array.isArray((packsPayload as { items?: unknown[] }).items)
      ? ((packsPayload as { items: Array<{ id?: string; source_url?: string }> }).items ?? [])
      : []);
  const existingPack = packs.find((p) => p?.source_url?.trim().toLowerCase() === DEFAULT_SKILL_PACK_URL);

  let packId = existingPack?.id?.trim() ?? "";
  if (!packId) {
    const createPackRes = await fetch(`${MISSION_CONTROL_BACKEND_URL}/api/v1/skills/packs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source_url: DEFAULT_SKILL_PACK_URL,
        name: "OpenClaw Skills",
        description: "Official OpenClaw skills pack",
        branch: "main",
      }),
    });
    if (createPackRes.ok) {
      const created = (await createPackRes.json()) as { id?: string };
      packId = created.id?.trim() ?? "";
    }
  }

  if (!packId) return;
  await fetch(`${MISSION_CONTROL_BACKEND_URL}/api/v1/skills/packs/${encodeURIComponent(packId)}/sync`, {
    method: "POST",
    headers,
  });
}

function buildProxyHeaders(sessionEmail: string, sessionName: string): Record<string, string> {
  return {
    "x-oc-user-email": sessionEmail,
    "x-oc-user-name": sessionName,
    "content-type": "application/json",
  };
}

function extractGatewayId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload)) {
    const first = payload[0] as { id?: unknown } | undefined;
    return typeof first?.id === "string" ? first.id : null;
  }
  const asPage = payload as { items?: Array<{ id?: unknown }> };
  const first = asPage.items?.[0];
  return typeof first?.id === "string" ? first.id : null;
}

async function ensureGatewayForUser(
  sessionEmail: string,
  sessionName: string,
): Promise<{ gatewayId: string; created: boolean; proxyHeaders: Record<string, string> }> {
  const proxyHeaders = buildProxyHeaders(sessionEmail, sessionName);
  const listRes = await fetch(`${MISSION_CONTROL_BACKEND_URL}/api/v1/gateways?limit=1&offset=0`, {
    headers: proxyHeaders,
  });

  if (!listRes.ok) {
    const detail = (await listRes.text()).slice(0, 500);
    throw new Error(`Failed to list Mission Control gateways: ${detail || listRes.status}`);
  }

  const listPayload = await listRes.json();
  const existingGatewayId = extractGatewayId(listPayload);
  if (existingGatewayId) {
    await ensureMarketplaceSeed(proxyHeaders, existingGatewayId);
    return { gatewayId: existingGatewayId, created: false, proxyHeaders };
  }

  const configuredGatewayUrl = toGatewayWsUrl(process.env.OPENCLAW_GATEWAY_URL ?? "ws://gateway:3005");
  const fallbackGatewayUrl = "ws://gateway:3005";
  const configuredGatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN?.trim() || null;
  const workspaceRoot = (process.env.OPENCLAW_GATEWAY_WORKSPACE_ROOT ?? "~/.openclaw").trim();
  const createGateway = async ({
    url,
    token,
    disableDevicePairing,
  }: {
    url: string;
    token: string | null;
    disableDevicePairing: boolean;
  }): Promise<{ id: string }> => {
    const createRes = await fetch(`${MISSION_CONTROL_BACKEND_URL}/api/v1/gateways`, {
      method: "POST",
      headers: proxyHeaders,
      body: JSON.stringify({
        name: "OpenClaw Gateway",
        url,
        token,
        workspace_root: workspaceRoot,
        allow_insecure_tls: false,
        disable_device_pairing: disableDevicePairing,
      }),
    });

    if (!createRes.ok) {
      const detail = (await createRes.text()).slice(0, 500);
      throw new Error(
        `Failed to create Mission Control gateway (${url}, disableDevicePairing=${disableDevicePairing}, token=${token ? "set" : "empty"}): ${detail || createRes.status}`,
      );
    }

    const created = (await createRes.json()) as { id?: string };
    if (!created?.id) {
      throw new Error(`Mission Control gateway created with ${url} but no ID returned`);
    }
    return { id: created.id };
  };

  const attempts: Array<{ url: string; token: string | null; disableDevicePairing: boolean }> = [];
  const seenAttempts = new Set<string>();
  const addAttempt = (url: string, token: string | null, disableDevicePairing: boolean) => {
    const key = `${url}|${token ?? ""}|${disableDevicePairing ? "1" : "0"}`;
    if (seenAttempts.has(key)) return;
    seenAttempts.add(key);
    attempts.push({ url, token, disableDevicePairing });
  };

  // Prefer control-ui style authentication first in hosted environments where
  // device pairing can be disabled and browser/device identity is not required.
  addAttempt(configuredGatewayUrl, configuredGatewayToken, true);
  addAttempt(configuredGatewayUrl, null, true);
  addAttempt(configuredGatewayUrl, configuredGatewayToken, false);
  addAttempt(configuredGatewayUrl, null, false);
  if (configuredGatewayUrl !== fallbackGatewayUrl) {
    addAttempt(fallbackGatewayUrl, configuredGatewayToken, true);
    addAttempt(fallbackGatewayUrl, null, true);
    addAttempt(fallbackGatewayUrl, configuredGatewayToken, false);
    addAttempt(fallbackGatewayUrl, null, false);
  }

  let createdId = "";
  let lastError: Error | null = null;
  for (const attempt of attempts) {
    try {
      const created = await createGateway(attempt);
      createdId = created.id;
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Unknown gateway create error");
    }
  }

  if (!createdId) {
    throw lastError ?? new Error("Mission Control gateway bootstrap failed");
  }

  await ensureMarketplaceSeed(proxyHeaders, createdId);
  return { gatewayId: createdId, created: true, proxyHeaders };
}

function readMissionControlEnv(): Record<string, string> {
  const candidates = [
    path.resolve(process.cwd(), "mission-control", "backend", ".env"),
    path.resolve(process.cwd(), "..", "..", "mission-control", "backend", ".env"),
    path.resolve(process.cwd(), "..", "mission-control", "backend", ".env"),
  ];

  for (const envPath of candidates) {
    try {
      const raw = readFileSync(envPath, "utf8");
      const entries = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const idx = line.indexOf("=");
          if (idx === -1) return null;
          const key = line.slice(0, idx).trim();
          const value = line.slice(idx + 1).trim();
          return [key, value] as const;
        })
        .filter((entry): entry is readonly [string, string] => Boolean(entry));

      return Object.fromEntries(entries);
    } catch {
      continue;
    }
  }

  return {};
}

router.get("/mission-control/launch", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const envFile = readMissionControlEnv();
  const authMode = (
    process.env.MISSION_CONTROL_AUTH_MODE
    || process.env.AUTH_MODE
    || envFile.AUTH_MODE
    || "local"
  ).trim().toLowerCase();
  const localAuthToken = (
    envFile.LOCAL_AUTH_TOKEN
    || process.env.MISSION_CONTROL_TOKEN
    || process.env.LOCAL_AUTH_TOKEN
    || ""
  ).trim();
  await trackUsageEvent(sessionEmail, "mission_control_open", {
    authMode,
  });
  return res.json({
    launchUrl: "/mission-control/dashboard",
    authMode,
    localAuthToken: localAuthToken || null,
  });
});

router.post("/mission-control/ensure-gateway", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const sessionName = (
    (typeof req.body?.name === "string" ? req.body.name : "")
    || sessionEmail.split("@")[0]
    || "OpenClaw User"
  ).trim();

  try {
    const result = await ensureGatewayForUser(sessionEmail, sessionName);
    return res.json({ gatewayId: result.gatewayId, created: result.created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: "Mission Control gateway bootstrap failed", detail: message });
  }
});

router.get("/mission-control/skills-catalog", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const sessionName = (sessionEmail.split("@")[0] || "OpenClaw User").trim();
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : DEFAULT_MARKETPLACE_LIMIT;

  try {
    const { gatewayId, proxyHeaders } = await ensureGatewayForUser(sessionEmail, sessionName);
    let skillsRes = await fetch(
      `${MISSION_CONTROL_BACKEND_URL}/api/v1/skills/marketplace?gateway_id=${encodeURIComponent(gatewayId)}&limit=${limit}`,
      { headers: proxyHeaders },
    );

    if (!skillsRes.ok) {
      await ensureMarketplaceSeed(proxyHeaders, gatewayId);
      skillsRes = await fetch(
        `${MISSION_CONTROL_BACKEND_URL}/api/v1/skills/marketplace?gateway_id=${encodeURIComponent(gatewayId)}&limit=${limit}`,
        { headers: proxyHeaders },
      );
    }

    if (!skillsRes.ok) {
      const detail = (await skillsRes.text()).slice(0, 500);
      return res.status(502).json({ error: "Unable to load skills catalog", detail });
    }

    const payload = (await skillsRes.json()) as unknown;
    const skills = Array.isArray(payload)
      ? payload
      : (typeof payload === "object" && payload !== null && Array.isArray((payload as { items?: unknown[] }).items)
        ? (payload as { items: unknown[] }).items
        : []);
    return res.json({ gatewayId, skills });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: "Failed to resolve skills catalog", detail: message });
  }
});

router.post("/mission-control/skills/install", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const skillId = typeof req.body?.skillId === "string" ? req.body.skillId.trim() : "";
  if (!skillId) {
    return res.status(400).json({ error: "skillId is required" });
  }

  const sessionName = (sessionEmail.split("@")[0] || "OpenClaw User").trim();
  const providedGatewayId = typeof req.body?.gatewayId === "string" ? req.body.gatewayId.trim() : "";

  try {
    const ensured = providedGatewayId
      ? { gatewayId: providedGatewayId, proxyHeaders: buildProxyHeaders(sessionEmail, sessionName) }
      : await ensureGatewayForUser(sessionEmail, sessionName);

    const installRes = await fetch(
      `${MISSION_CONTROL_BACKEND_URL}/api/v1/skills/marketplace/${encodeURIComponent(skillId)}/install?gateway_id=${encodeURIComponent(ensured.gatewayId)}`,
      {
        method: "POST",
        headers: ensured.proxyHeaders,
      },
    );

    if (!installRes.ok) {
      const detail = (await installRes.text()).slice(0, 500);
      return res.status(502).json({ error: "Failed to install selected skill", detail });
    }

    const payload = (await installRes.json().catch(() => ({}))) as Record<string, unknown>;
    return res.json({ gatewayId: ensured.gatewayId, ...payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: "Failed to install selected skill", detail: message });
  }
});

export default router;
