import { readFileSync } from "fs";
import { mkdirSync, openSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { Router } from "express";
import { spawn } from "child_process";
import { isValidInstanceUrl } from "../instanceUrlValidator";
import { setSessionCookie, getSessionEmail } from "../sessionAuth";
import {
  getLocalAgent,
  getLocalInstanceUrl,
  getLocalSubscription,
  isDbEnabled,
  provisionLocalAgent,
} from "../localDev";
import { trackUsageEvent } from "../usageTracking";
import { inferPlanTierFromSubscriptionItem, isProOrTeamTier } from "../planTier";

const router = Router();
const WHATSAPP_QR_OUT_PATH = path.join(process.cwd(), ".wa-login.out.log");
const WHATSAPP_QR_ERR_PATH = path.join(process.cwd(), ".wa-login.err.log");
const CHANNEL_OPERATION_TIMEOUT_MS = 45_000;

function getPublicGatewayWsUrl(req: import("express").Request): string | null {
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      const wsProto = parsed.protocol === "https:" ? "wss:" : "ws:";
      return `${wsProto}//${parsed.host}/api/gateway`;
    } catch {}
  }

  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const isHttps = req.protocol === "https" || forwardedProto === "https";
  const protocol = isHttps ? "wss" : "ws";
  const host = req.get("host");
  if (!host?.trim()) return null;
  return `${protocol}://${host}/api/gateway`;
}

function getSharedGatewayInstanceUrl(): string | null {
  const raw = process.env.OPENCLAW_GATEWAY_URL?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return null;
}

function getOpenClawCliPath(): string {
  const explicitPath = process.env.OPENCLAW_CLI_PATH?.trim();
  if (explicitPath) return explicitPath;

  if (process.platform !== "win32") {
    return "openclaw";
  }

  const appData = process.env.APPDATA;
  if (appData?.trim()) {
    return path.join(appData, "npm", "openclaw.cmd");
  }
  return path.join(os.homedir(), "AppData", "Roaming", "npm", "openclaw.cmd");
}

function getLocalGatewayToken(): string | null {
  try {
    const configPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as {
      gateway?: { auth?: { mode?: string; token?: string } };
    };
    const token = parsed.gateway?.auth?.token?.trim();
    return token || null;
  } catch {
    return null;
  }
}

function getSharedGatewayToken(): string | null {
  const token = process.env.OPENCLAW_GATEWAY_TOKEN?.trim();
  return token || null;
}

let cachedScopedGatewayToken: { token: string; expiresAt: number } | null = null;

async function getScopedGatewayToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedScopedGatewayToken && cachedScopedGatewayToken.expiresAt > now) {
    return cachedScopedGatewayToken.token;
  }

  const dashboardResult = await runOpenClawCli(["dashboard", "--no-open"], 20_000);
  const dashboardOutput = `${dashboardResult.stdout}\n${dashboardResult.stderr}`;
  const tokenMatch = dashboardOutput.match(/[?#&]token=([^&#\s]+)/i);
  if (tokenMatch?.[1]) {
    const token = decodeURIComponent(tokenMatch[1]);
    // Dashboard tokens are short-lived; refresh conservatively every 3 minutes.
    cachedScopedGatewayToken = { token, expiresAt: now + 3 * 60_000 };
    return token;
  }

  return getSharedGatewayToken();
}

function getLocalOpenClawConfigPath(): string {
  return path.join(os.homedir(), ".openclaw", "openclaw.json");
}

function readLocalOpenClawConfig(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(getLocalOpenClawConfigPath(), "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeLocalOpenClawConfig(config: Record<string, unknown>): void {
  const configPath = getLocalOpenClawConfigPath();
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function getProviderBaseUrl(provider: string): string {
  switch (provider) {
    case "openai":
      return "https://api.openai.com/v1";
    case "gemini":
      return "https://generativelanguage.googleapis.com/v1beta";
    case "qwen":
      return "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
    case "moonshot":
      return "https://api.moonshot.ai/v1";
    case "anthropic":
    default:
      return "https://api.anthropic.com";
  }
}

async function runOpenClawCli(args: string[], timeoutMs = CHANNEL_OPERATION_TIMEOUT_MS): Promise<{
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  const cliPath = getOpenClawCliPath();

  return await new Promise((resolve) => {
    const child = spawn(cliPath, args, {
      windowsHide: true,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try {
          child.kill();
        } catch {}
        resolve({ ok: false, code: null, stdout, stderr: `${stderr}\nTimeout after ${timeoutMs}ms` });
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({ ok: false, code: null, stdout, stderr: `${stderr}\n${error.message}` });
      }
    });

    child.on("close", (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({ ok: code === 0, code, stdout, stderr });
      }
    });
  });
}

function toCliOptionName(field: string): string {
  return `--${field.replace(/_/g, "-")}`;
}

function isProOrTeamPlanName(planName: string | null | undefined): boolean {
  return Boolean(planName && /(pro|team)/i.test(planName));
}

async function hasProTierAccess(email: string): Promise<boolean> {
  if (!isDbEnabled()) {
    const localSub = getLocalSubscription(email);
    if (localSub?.status === "active" && isProOrTeamPlanName(localSub.planName)) {
      return true;
    }

    // In no-db mode, users can still have a valid Stripe subscription even without
    // a locally persisted subscription mirror. Check Stripe as a fallback.
    try {
      const { getUncachableStripeClient } = await import("../stripeClient");
      const stripe = await getUncachableStripeClient();
      const customers = await stripe.customers.list({ email, limit: 1 });
      const customer = customers.data[0];
      if (!customer) return false;

      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 10,
        expand: ["data.items.data.price.product"],
      });
      const activeSub = subscriptions.data.find(
        (item) => item.status === "active" || item.status === "trialing",
      );
      if (!activeSub) return false;

      const firstItem = activeSub.items.data[0];
      const planName = firstItem?.plan?.nickname || firstItem?.price?.nickname || null;
      return isProOrTeamPlanName(planName) || isProOrTeamTier(inferPlanTierFromSubscriptionItem(firstItem));
    } catch {
      return false;
    }
  }

  try {
    const { storage } = await import("../storage");
    const customer = await storage.getCustomerByEmail(email);
    if (!customer) return false;
    const sub = await storage.getSubscriptionByCustomerId(customer.id);
    if (!sub || sub.status !== "active") return false;

    let planName: string | null = null;
    let planTier: ReturnType<typeof inferPlanTierFromSubscriptionItem> = null;
    try {
      const firstItem = Array.isArray(sub.items?.data) ? sub.items.data[0] : null;
      planName = firstItem?.plan?.nickname || firstItem?.price?.nickname || null;
      planTier = inferPlanTierFromSubscriptionItem(firstItem);
    } catch {}

    return isProOrTeamPlanName(planName) || isProOrTeamTier(planTier);
  } catch {
    return false;
  }
}

function getClawHubConfig(config: Record<string, unknown>): Record<string, unknown> | null {
  const integrations = (config.integrations as Record<string, unknown> | undefined) ?? {};
  const clawhub = integrations.clawhub;
  return clawhub && typeof clawhub === "object" ? (clawhub as Record<string, unknown>) : null;
}

function setClawHubConfig(
  config: Record<string, unknown>,
  payload: { apiKey: string; workspaceId: string; pluginSpec?: string },
): Record<string, unknown> {
  const integrations = (config.integrations as Record<string, unknown> | undefined) ?? {};
  const nextIntegrations = {
    ...integrations,
    clawhub: {
      apiKey: payload.apiKey,
      workspaceId: payload.workspaceId,
      pluginSpec: payload.pluginSpec ?? "",
      connectedAt: new Date().toISOString(),
    },
  };
  return { ...config, integrations: nextIntegrations };
}

function clearClawHubConfig(config: Record<string, unknown>): Record<string, unknown> {
  const integrations = (config.integrations as Record<string, unknown> | undefined) ?? {};
  if (!("clawhub" in integrations)) return config;
  const nextIntegrations = { ...integrations };
  delete nextIntegrations.clawhub;
  return { ...config, integrations: nextIntegrations };
}

router.post("/provision", async (req, res) => {
  const { userId, email, instanceUrl } = req.body as {
    userId?: string;
    email?: string;
    instanceUrl?: string;
  };
  const id = userId || email;
  if (!id) {
    return res.status(400).json({ error: "userId or email is required" });
  }

  const existingSession = getSessionEmail(req);
  if (existingSession && existingSession !== id) {
    return res.status(403).json({ error: "Session identity mismatch" });
  }

  if (instanceUrl && !isValidInstanceUrl(instanceUrl)) {
    return res
      .status(400)
      .json({ error: "Invalid instanceUrl: must be a valid HTTPS URL on an allowed domain" });
  }

  if (!isDbEnabled()) {
    const agent = provisionLocalAgent(id, instanceUrl ?? getLocalInstanceUrl());
    setSessionCookie(res, id);
    return res.json({ agent, provisioned: true, localDev: true });
  }

  const { storage } = await import("../storage");
  const { provisionInstance, isDockerProvisioningEnabled } = await import("../dockerProvisioner");
  const { db } = await import("@workspace/db");
  const { userAgentsTable } = await import("@workspace/db/schema");
  const { eq } = await import("drizzle-orm");

  const customer = await storage.getCustomerByEmail(id);
  if (!customer) {
    return res.status(403).json({ error: "No active customer found for this email" });
  }

  const sub = await storage.getSubscriptionByCustomerId(customer.id);
  if (!sub) {
    return res.status(403).json({ error: "Active subscription required" });
  }

  try {
    const existing = await db
      .select()
      .from(userAgentsTable)
      .where(eq(userAgentsTable.userId, id))
      .limit(1);

    let resolvedInstanceUrl: string | null = instanceUrl || null;
    if (!resolvedInstanceUrl && isDockerProvisioningEnabled()) {
      resolvedInstanceUrl = await provisionInstance(id);
    }
    if (!resolvedInstanceUrl && !isDockerProvisioningEnabled()) {
      // In shared-gateway deployments (like Hetzner), use the configured gateway URL
      // so users do not get stuck in "pending" forever.
      resolvedInstanceUrl = getSharedGatewayInstanceUrl();
    }

    if (existing.length > 0) {
      setSessionCookie(res, id);

      const needsUpdate = resolvedInstanceUrl && existing[0].instanceUrl !== resolvedInstanceUrl;
      if (needsUpdate) {
        const [updated] = await db
          .update(userAgentsTable)
          .set({ instanceUrl: resolvedInstanceUrl })
          .where(eq(userAgentsTable.userId, id))
          .returning();
        return res.json({ agent: updated, provisioned: false, updated: true });
      }
      return res.json({ agent: existing[0], provisioned: false });
    }

    const agentName = `user-${id.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 32)}`;

    const [agent] = await db
      .insert(userAgentsTable)
      .values({
        userId: id,
        agentName,
        status: "active",
        instanceUrl: resolvedInstanceUrl,
      })
      .returning();

    setSessionCookie(res, id);
    console.log(`[openclaw] provisioned agent ${agentName} for user ${id}`);
    return res.json({ agent, provisioned: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Provisioning failed";
    console.error("[openclaw] provision error:", message);
    return res.status(500).json({ error: message });
  }
});

router.get("/instance", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!isDbEnabled()) {
    const agent = getLocalAgent(sessionEmail) ?? provisionLocalAgent(sessionEmail, getLocalInstanceUrl());
    return res.json({
      agent,
      instanceUrl: agent.instanceUrl || null,
      ready: !!agent.instanceUrl,
      webhookUrls: null,
      localDev: true,
    });
  }

  const { db } = await import("@workspace/db");
  const { userAgentsTable } = await import("@workspace/db/schema");
  const { eq } = await import("drizzle-orm");

  const existing = await db
    .select()
    .from(userAgentsTable)
    .where(eq(userAgentsTable.userId, sessionEmail))
    .limit(1);

  if (existing.length === 0) {
    return res.status(404).json({ error: "No agent found for this user" });
  }

  const appUrl = process.env.APP_URL || "";
  const webhookBase = appUrl ? `${appUrl}/api/hook` : null;

  return res.json({
    agent: existing[0],
    instanceUrl: existing[0].instanceUrl || null,
    ready: !!existing[0].instanceUrl,
    webhookUrls: webhookBase
      ? {
          telegram: `${webhookBase}/telegram/${sessionEmail}`,
          line: `${webhookBase}/line/${sessionEmail}`,
          gchat: `${webhookBase}/gchat/${sessionEmail}`,
          slack: `${webhookBase}/slack/${sessionEmail}`,
        }
      : null,
  });
});

router.get("/agent", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!isDbEnabled()) {
    const agent = getLocalAgent(sessionEmail) ?? provisionLocalAgent(sessionEmail, getLocalInstanceUrl());
    return res.json({ agent, localDev: true });
  }

  const { db } = await import("@workspace/db");
  const { userAgentsTable } = await import("@workspace/db/schema");
  const { eq } = await import("drizzle-orm");

  const existing = await db
    .select()
    .from(userAgentsTable)
    .where(eq(userAgentsTable.userId, sessionEmail))
    .limit(1);

  if (existing.length === 0) {
    return res.status(404).json({ error: "No agent found for this user" });
  }

  return res.json({ agent: existing[0] });
});

router.get("/launch", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const publicGatewayWsUrl = getPublicGatewayWsUrl(req);

  if (!isDbEnabled()) {
    const agent = getLocalAgent(sessionEmail) ?? provisionLocalAgent(sessionEmail, getLocalInstanceUrl());
    const token = getLocalGatewayToken();
    const queryParams = new URLSearchParams();
    if (publicGatewayWsUrl) queryParams.set("gatewayUrl", publicGatewayWsUrl);
    const hashParams = new URLSearchParams();
    if (token) {
      hashParams.set("token", token);
    }
    const query = queryParams.toString();
    const hash = hashParams.toString();
    const launchUrl = `/api/gateway/chat${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
    await trackUsageEvent(sessionEmail, "terminal_open", {
      source: "openclaw_launch",
      mode: "local-dev",
    });
    return res.json({
      launchUrl,
      localDev: true,
      ready: Boolean(agent.instanceUrl),
    });
  }

  // Shared-gateway deployments (Hetzner) should always launch via the API gateway proxy
  // so users skip manual dashboard connection and token entry.
  const sharedGateway = getSharedGatewayInstanceUrl();
  if (sharedGateway) {
    const token = await getScopedGatewayToken();
    const queryParams = new URLSearchParams();
    if (publicGatewayWsUrl) queryParams.set("gatewayUrl", publicGatewayWsUrl);
    const hashParams = new URLSearchParams();
    if (token) {
      hashParams.set("token", token);
    }
    const query = queryParams.toString();
    const hash = hashParams.toString();
    const launchUrl = `/api/gateway/chat${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;

    await trackUsageEvent(sessionEmail, "terminal_open", {
      source: "openclaw_launch",
      mode: "shared-gateway",
    });
    return res.json({ launchUrl, localDev: false, ready: true });
  }

  const { db } = await import("@workspace/db");
  const { userAgentsTable } = await import("@workspace/db/schema");
  const { eq } = await import("drizzle-orm");

  const existing = await db
    .select()
    .from(userAgentsTable)
    .where(eq(userAgentsTable.userId, sessionEmail))
    .limit(1);

  if (existing.length === 0 || !existing[0].instanceUrl) {
    return res.status(404).json({ error: "No instance URL configured for this user" });
  }

  const launchUrl = "/api/instance-proxy/chat";
  await trackUsageEvent(sessionEmail, "terminal_open", {
    source: "openclaw_launch",
    mode: "db",
  });
  return res.json({ launchUrl, localDev: false, ready: true });
});

router.post("/settings", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const {
    mode,
    provider,
    model,
    apiKey,
  } = req.body as {
    mode?: string;
    provider?: string;
    model?: string;
    apiKey?: string;
  };

  if (!provider?.trim() || !model?.trim()) {
    return res.status(400).json({ error: "provider and model are required" });
  }

  if (mode === "byok" && !apiKey?.trim()) {
    return res.status(400).json({ error: "apiKey is required in byok mode" });
  }

  const config = readLocalOpenClawConfig();
  const models = (config.models as Record<string, unknown> | undefined) ?? {};
  const providers = (models.providers as Record<string, unknown> | undefined) ?? {};
  const providerConfig = (providers[provider] as Record<string, unknown> | undefined) ?? {};

  providers[provider] = {
    ...providerConfig,
    baseUrl: providerConfig.baseUrl ?? getProviderBaseUrl(provider),
    apiKey: mode === "byok" ? apiKey?.trim() : providerConfig.apiKey ?? "",
  };

  const agents = (config.agents as Record<string, unknown> | undefined) ?? {};
  const defaults = (agents.defaults as Record<string, unknown> | undefined) ?? {};
  const modelConfig = (defaults.model as Record<string, unknown> | undefined) ?? {};

  config.models = {
    ...models,
    providers,
  };
  config.agents = {
    ...agents,
    defaults: {
      ...defaults,
      model: {
        ...modelConfig,
        primary: `${provider}/${model}`,
      },
    },
  };

  writeLocalOpenClawConfig(config);
  await trackUsageEvent(sessionEmail, "settings_sync", {
    provider,
    model,
    mode: mode ?? "payg",
  });
  return res.json({ ok: true });
});

router.post("/whatsapp/qr/start", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const cliPath = getOpenClawCliPath();
    mkdirSync(path.dirname(WHATSAPP_QR_OUT_PATH), { recursive: true });
    const outFd = openSync(WHATSAPP_QR_OUT_PATH, "w");
    const errFd = openSync(WHATSAPP_QR_ERR_PATH, "w");

    const child = spawn(
      cliPath,
      ["channels", "login", "--channel", "whatsapp", "--verbose"],
      {
        detached: true,
        windowsHide: true,
        stdio: ["ignore", outFd, errFd],
      },
    );
    child.unref();
    await trackUsageEvent(sessionEmail, "whatsapp_qr_start", { source: "setup" });
    return res.json({ started: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to start WhatsApp QR login";
    return res.status(500).json({ error: message });
  }
});

router.get("/channels/status", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const result = await runOpenClawCli(["channels", "list", "--json"]);
  if (!result.ok) {
    return res.status(500).json({ error: "Failed to read channel status", details: result.stderr || result.stdout });
  }

  try {
    const parsed = JSON.parse(result.stdout) as {
      channels?: Array<{ channel?: string; enabled?: boolean; accounts?: Array<{ enabled?: boolean; linked?: boolean }> }>;
    };
    const status: Record<string, boolean> = {};

    for (const channel of parsed.channels ?? []) {
      const id = String(channel.channel ?? "").trim().toLowerCase();
      if (!id) continue;
      const hasEnabledAccount = (channel.accounts ?? []).some((a) => a.enabled || a.linked);
      status[id] = Boolean(hasEnabledAccount);
    }

    return res.json({ status });
  } catch {
    return res.status(500).json({ error: "Invalid channels list output" });
  }
});

router.post("/channels/connect", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const { channel, fields } = req.body as {
    channel?: string;
    fields?: Record<string, string>;
  };

  const normalizedChannel = channel?.trim().toLowerCase();
  if (!normalizedChannel) {
    return res.status(400).json({ error: "channel is required" });
  }

  if (normalizedChannel === "whatsapp") {
    return res.status(400).json({ error: "Use WhatsApp QR login for this channel" });
  }

  if (normalizedChannel === "clawhub") {
    const allowed = await hasProTierAccess(sessionEmail);
    if (!allowed) {
      return res.status(403).json({ error: "ClawHub integration requires a Pro or Team plan" });
    }
  }

  const channelAliases: Record<string, string> = {
    gchat: "googlechat",
  };
  const cliChannel = channelAliases[normalizedChannel] ?? normalizedChannel;

  const args = ["channels", "add", "--channel", cliChannel];
  for (const [key, value] of Object.entries(fields ?? {})) {
    const safeValue = String(value ?? "").trim();
    if (!safeValue) continue;
    args.push(toCliOptionName(key), safeValue);
  }

  const result = await runOpenClawCli(args);
  if (!result.ok) {
    return res.status(400).json({ error: "Failed to connect channel", details: result.stderr || result.stdout });
  }

  return res.json({ ok: true });
});

router.post("/channels/disconnect", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const { channel } = req.body as { channel?: string };
  const normalizedChannel = channel?.trim().toLowerCase();
  if (!normalizedChannel) {
    return res.status(400).json({ error: "channel is required" });
  }

  const channelAliases: Record<string, string> = {
    gchat: "googlechat",
  };
  const cliChannel = channelAliases[normalizedChannel] ?? normalizedChannel;
  const result = await runOpenClawCli(["channels", "remove", "--channel", cliChannel, "--delete"]);

  if (!result.ok) {
    return res.status(400).json({ error: "Failed to disconnect channel", details: result.stderr || result.stdout });
  }

  return res.json({ ok: true });
});

router.get("/clawhub/status", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const hasAccess = await hasProTierAccess(sessionEmail);
  const config = readLocalOpenClawConfig();
  const clawhub = getClawHubConfig(config);
  return res.json({
    connected: Boolean(clawhub),
    hasAccess,
    workspaceId: typeof clawhub?.workspaceId === "string" ? clawhub.workspaceId : null,
  });
});

router.post("/clawhub/connect", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const hasAccess = await hasProTierAccess(sessionEmail);
  if (!hasAccess) {
    return res.status(403).json({ error: "ClawHub integration requires a Pro or Team plan" });
  }

  const { apiKey, workspaceId, pluginSpec } = req.body as {
    apiKey?: string;
    workspaceId?: string;
    pluginSpec?: string;
  };

  const safeApiKey = String(apiKey ?? "").trim();
  const safeWorkspaceId = String(workspaceId ?? "").trim();
  const safePluginSpec = String(pluginSpec ?? "").trim();

  if (!safeApiKey || !safeWorkspaceId) {
    return res.status(400).json({ error: "apiKey and workspaceId are required" });
  }

  const next = setClawHubConfig(readLocalOpenClawConfig(), {
    apiKey: safeApiKey,
    workspaceId: safeWorkspaceId,
    pluginSpec: safePluginSpec,
  });
  writeLocalOpenClawConfig(next);

  // Optional: install plugin immediately if a package spec is provided.
  if (safePluginSpec) {
    const installResult = await runOpenClawCli(["plugins", "install", safePluginSpec], 120_000);
    if (!installResult.ok) {
      return res.status(400).json({
        error: "ClawHub connected, but plugin install failed",
        details: installResult.stderr || installResult.stdout,
      });
    }
  }

  return res.json({ ok: true, connected: true });
});

router.post("/clawhub/disconnect", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const next = clearClawHubConfig(readLocalOpenClawConfig());
  writeLocalOpenClawConfig(next);
  return res.json({ ok: true, connected: false });
});

router.post("/clawhub/sync", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const hasAccess = await hasProTierAccess(sessionEmail);
  if (!hasAccess) {
    return res.status(403).json({ error: "ClawHub integration requires a Pro or Team plan" });
  }

  const clawhub = getClawHubConfig(readLocalOpenClawConfig());
  if (!clawhub) {
    return res.status(400).json({ error: "ClawHub is not connected" });
  }

  const pluginSpec =
    typeof clawhub.pluginSpec === "string" ? clawhub.pluginSpec.trim() : "";

  const steps: Array<{ step: string; ok: boolean; output: string }> = [];

  if (pluginSpec) {
    const install = await runOpenClawCli(["plugins", "install", pluginSpec], 120_000);
    steps.push({
      step: `plugins install ${pluginSpec}`,
      ok: install.ok,
      output: (install.stderr || install.stdout || "").trim(),
    });
    if (!install.ok) {
      return res.status(400).json({ error: "Failed to install ClawHub plugin", steps });
    }
  }

  const update = await runOpenClawCli(["plugins", "update"], 120_000);
  steps.push({
    step: "plugins update",
    ok: update.ok,
    output: (update.stderr || update.stdout || "").trim(),
  });
  if (!update.ok) {
    return res.status(400).json({ error: "Failed to update plugins", steps });
  }

  const check = await runOpenClawCli(["skills", "check"], 120_000);
  steps.push({
    step: "skills check",
    ok: check.ok,
    output: (check.stderr || check.stdout || "").trim(),
  });
  if (!check.ok) {
    return res.status(400).json({ error: "Skills check failed", steps });
  }

  const list = await runOpenClawCli(["skills", "list"], 120_000);
  steps.push({
    step: "skills list",
    ok: list.ok,
    output: (list.stderr || list.stdout || "").trim(),
  });
  if (!list.ok) {
    return res.status(400).json({ error: "Skills list failed", steps });
  }

  return res.json({ ok: true, steps });
});

router.get("/whatsapp/qr", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const raw = readFileSync(WHATSAPP_QR_OUT_PATH, "utf8");
    const marker = "Scan this QR in WhatsApp (Linked Devices):";
    const idx = raw.lastIndexOf(marker);
    if (idx < 0) {
      return res.json({ ready: false });
    }

    const tail = raw.slice(idx + marker.length);
    const lines = tail.split(/\r?\n/);
    const qrLines: string[] = [];
    for (const line of lines) {
      if (!line.trim()) {
        if (qrLines.length > 0) break;
        continue;
      }
      if (/^[\u2580-\u259f\s]+$/.test(line)) {
        qrLines.push(line);
        continue;
      }
      if (qrLines.length > 0) {
        break;
      }
    }

    if (qrLines.length === 0) {
      return res.json({ ready: false });
    }

    return res.json({ ready: true, qr: qrLines.join("\n") });
  } catch {
    return res.json({ ready: false });
  }
});

export default router;
