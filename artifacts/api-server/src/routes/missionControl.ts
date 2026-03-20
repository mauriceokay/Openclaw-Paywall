import { readFileSync } from "fs";
import path from "path";
import { Router } from "express";
import { getSessionEmail } from "../sessionAuth";
import { trackUsageEvent } from "../usageTracking";

const router = Router();
const MISSION_CONTROL_BACKEND_URL = (process.env.MISSION_CONTROL_BACKEND_URL ?? "http://127.0.0.1:8001").replace(/\/+$/, "");
const DEFAULT_SKILL_PACK_URL = "https://github.com/openclaw/openclaw";

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
  const existingCards = (await marketplaceProbe.json()) as unknown;
  if (Array.isArray(existingCards) && existingCards.length > 0) return;

  const packsRes = await fetch(`${MISSION_CONTROL_BACKEND_URL}/api/v1/skills/packs`, { headers });
  if (!packsRes.ok) return;
  const packs = (await packsRes.json()) as Array<{ id?: string; source_url?: string }>;
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

  const proxyHeaders: Record<string, string> = {
    "x-oc-user-email": sessionEmail,
    "x-oc-user-name": sessionName,
    "content-type": "application/json",
  };

  const extractGatewayId = (payload: unknown): string | null => {
    if (!payload || typeof payload !== "object") return null;
    if (Array.isArray(payload)) {
      const first = payload[0] as { id?: unknown } | undefined;
      return typeof first?.id === "string" ? first.id : null;
    }
    const asPage = payload as { items?: Array<{ id?: unknown }> };
    const first = asPage.items?.[0];
    return typeof first?.id === "string" ? first.id : null;
  };

  try {
    const listRes = await fetch(`${MISSION_CONTROL_BACKEND_URL}/api/v1/gateways?limit=1&offset=0`, {
      headers: proxyHeaders,
    });

    if (!listRes.ok) {
      return res.status(502).json({ error: "Failed to list Mission Control gateways" });
    }

    const listPayload = await listRes.json();
    const existingGatewayId = extractGatewayId(listPayload);
    if (existingGatewayId) {
      try {
        await ensureMarketplaceSeed(proxyHeaders, existingGatewayId);
      } catch {}
      return res.json({ gatewayId: existingGatewayId, created: false });
    }

    const gatewayUrl = toGatewayWsUrl(process.env.OPENCLAW_GATEWAY_URL ?? "ws://gateway:3005");
    const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN?.trim() || null;
    const workspaceRoot = (process.env.OPENCLAW_GATEWAY_WORKSPACE_ROOT ?? "~/.openclaw").trim();

    const createRes = await fetch(`${MISSION_CONTROL_BACKEND_URL}/api/v1/gateways`, {
      method: "POST",
      headers: proxyHeaders,
      body: JSON.stringify({
        name: "OpenClaw Gateway",
        url: gatewayUrl,
        token: gatewayToken,
        workspace_root: workspaceRoot,
        allow_insecure_tls: false,
        disable_device_pairing: false,
      }),
    });

    if (!createRes.ok) {
      const raw = await createRes.text();
      const detail = raw.slice(0, 500);
      return res.status(502).json({ error: "Failed to create Mission Control gateway", detail });
    }

    const created = (await createRes.json()) as { id?: string };
    if (!created?.id) {
      return res.status(502).json({ error: "Mission Control gateway created but no ID returned" });
    }

    try {
      await ensureMarketplaceSeed(proxyHeaders, created.id);
    } catch {}

    return res.json({ gatewayId: created.id, created: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: "Mission Control gateway bootstrap failed", detail: message });
  }
});

export default router;
