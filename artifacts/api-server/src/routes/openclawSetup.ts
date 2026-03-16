import { Router } from "express";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import os from "os";
import { getSessionEmail } from "../sessionAuth";
import { pool } from "@workspace/db";

const router = Router();

const CONFIG_PATH = path.join(os.homedir(), ".openclaw", "openclaw.json");

function readOpenclawConfig(): Record<string, unknown> {
  if (!existsSync(CONFIG_PATH)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeOpenclawConfig(config: Record<string, unknown>): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

function reloadGateway(): void {
  try {
    const output = execSync("pgrep -f 'openclaw gateway run'", { encoding: "utf8" }).trim();
    const pids = output.split("\n").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
    for (const pid of pids) {
      try {
        process.kill(pid, "SIGUSR1");
        console.log(`[openclaw-setup] Sent SIGUSR1 to gateway PID ${pid}`);
      } catch {
        // Process may have exited already
      }
    }
  } catch {
    // No gateway process running
  }
}

/**
 * POST /api/openclaw/apply-setup-config
 * Patches ~/.openclaw/openclaw.json with the user's Setup configuration
 * and sends SIGUSR1 to the running gateway to hot-reload.
 */
router.post("/openclaw/apply-setup-config", async (req, res) => {
  const email = getSessionEmail(req);
  if (!email) return res.status(401).json({ error: "Authentication required" });

  const {
    mode,
    apiKey,
    provider,
    model,
    telegramToken,
    whatsappToken,
    whatsappPhoneId,
    slackToken,
  } = req.body as {
    mode?: string;
    apiKey?: string;
    provider?: string;
    model?: string;
    telegramToken?: string;
    whatsappToken?: string;
    whatsappPhoneId?: string;
    slackToken?: string;
  };

  const config = readOpenclawConfig();

  // --- AI provider / API key ---
  if (mode === "byok" && apiKey && provider) {
    if (!config.env) config.env = {};
    const env = config.env as Record<string, unknown>;
    if (!env.vars) env.vars = {};
    const vars = env.vars as Record<string, string>;

    if (provider === "anthropic") vars.ANTHROPIC_API_KEY = apiKey;
    else if (provider === "openai") vars.OPENAI_API_KEY = apiKey;
    else if (provider === "gemini") vars.GEMINI_API_KEY = apiKey;
  }

  // --- Model selection ---
  if (model && provider) {
    if (!config.agent) config.agent = {};
    const agent = config.agent as Record<string, unknown>;
    const prefix = provider === "openai" ? "openai" : provider === "gemini" ? "google" : "anthropic";
    agent.model = { primary: `${prefix}/${model}` };
  }

  // --- Platform channel tokens ---
  if (!config.channels) config.channels = {};
  const channels = config.channels as Record<string, unknown>;

  if (telegramToken) {
    const existing = (channels.telegram as Record<string, unknown>) ?? {};
    channels.telegram = { ...existing, enabled: true, botToken: telegramToken };
  }

  if (slackToken) {
    const existing = (channels.slack as Record<string, unknown>) ?? {};
    channels.slack = { ...existing, token: slackToken };
  }

  if (whatsappToken) {
    const existing = (channels.whatsapp as Record<string, unknown>) ?? {};
    const waUpdate: Record<string, unknown> = { ...existing, enabled: true };
    if (whatsappPhoneId) waUpdate.phoneNumberId = whatsappPhoneId;
    // Store the API token in env so OpenClaw can use it
    if (!config.env) config.env = {};
    const env = config.env as Record<string, unknown>;
    if (!env.vars) env.vars = {};
    (env.vars as Record<string, string>).WHATSAPP_TOKEN = whatsappToken;
    channels.whatsapp = waUpdate;
  }

  writeOpenclawConfig(config);
  reloadGateway();

  // Persist a non-sensitive summary to the DB so the dashboard can show setup status
  try {
    await pool.query(
      `UPDATE app.users
       SET openclaw_setup_mode = $1, openclaw_setup_provider = $2, openclaw_setup_at = NOW()
       WHERE email = $3`,
      [mode ?? null, provider ?? null, email],
    );
  } catch {
    // Column may not exist in older deployments; ignore gracefully
  }

  console.log(`[openclaw-setup] Config applied for ${email}: mode=${mode}, provider=${provider}`);
  return res.json({ ok: true });
});

/**
 * GET /api/openclaw/setup-status
 * Returns whether the user has completed setup configuration.
 */
router.get("/openclaw/setup-status", async (req, res) => {
  const email = getSessionEmail(req);
  if (!email) return res.status(401).json({ error: "Authentication required" });

  try {
    const result = await pool.query(
      `SELECT openclaw_setup_mode, openclaw_setup_provider, openclaw_setup_at FROM app.users WHERE email = $1 LIMIT 1`,
      [email],
    );
    if (!result.rows[0]) return res.status(404).json({ error: "User not found" });
    return res.json({
      configured: !!result.rows[0].openclaw_setup_at,
      mode: result.rows[0].openclaw_setup_mode ?? null,
      provider: result.rows[0].openclaw_setup_provider ?? null,
      configuredAt: result.rows[0].openclaw_setup_at ?? null,
    });
  } catch {
    return res.json({ configured: false, mode: null, provider: null, configuredAt: null });
  }
});

export default router;
