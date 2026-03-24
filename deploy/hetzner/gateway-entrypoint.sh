#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="/root/.openclaw"
CONFIG_FILE="${CONFIG_DIR}/openclaw.json"
PORT="${OPENCLAW_GATEWAY_PORT:-3005}"
TOKEN="${OPENCLAW_GATEWAY_TOKEN:-}"
AUTH_MODE="${OPENCLAW_GATEWAY_AUTH_MODE:-none}"

mkdir -p "${CONFIG_DIR}"

if [ ! -f "${CONFIG_FILE}" ]; then
  cat > "${CONFIG_FILE}" <<'JSON'
{
  "gateway": {
    "auth": {
      "mode": "none"
    },
    "trustedProxies": ["127.0.0.1", "::1"],
    "controlUi": {
      "allowInsecureAuth": true,
      "dangerouslyDisableDeviceAuth": true,
      "allowedOrigins": ["*"]
    }
  }
}
JSON
fi

# Ensure critical Control UI compatibility flags remain set even when a persisted
# config already exists in the mounted volume.
node <<'NODE'
const fs = require("fs");
const path = process.env.CONFIG_FILE || "/root/.openclaw/openclaw.json";
let cfg = {};
try {
  cfg = JSON.parse(fs.readFileSync(path, "utf8"));
} catch {}
cfg.gateway = cfg.gateway || {};
cfg.gateway.auth = cfg.gateway.auth || {};
const token = (process.env.OPENCLAW_GATEWAY_TOKEN || "").trim();
const authMode = (process.env.OPENCLAW_GATEWAY_AUTH_MODE || "none").trim().toLowerCase();
if (authMode === "token" && token) {
  // Optional token mode for hardened deployments.
  cfg.gateway.auth.mode = "token";
  cfg.gateway.auth.token = token;
} else {
  // Default to none to avoid scope/token mismatches breaking the embedded UI.
  cfg.gateway.auth.mode = "none";
  delete cfg.gateway.auth.token;
}
cfg.gateway.trustedProxies = Array.from(
  new Set([
    ...(Array.isArray(cfg.gateway.trustedProxies) ? cfg.gateway.trustedProxies : []),
    "127.0.0.1",
    "::1",
    "172.16.0.0/12",
    "10.0.0.0/8",
    "192.168.0.0/16",
  ]),
);
cfg.gateway.controlUi = cfg.gateway.controlUi || {};
cfg.gateway.controlUi.allowInsecureAuth = true;
cfg.gateway.controlUi.dangerouslyDisableDeviceAuth = true;
cfg.gateway.controlUi.allowedOrigins = ["*"];
cfg.gateway.tailscale = { mode: "off" };
// Never force canvas-host root here; it can trap users in the raw canvas shell.
if (cfg.gateway.controlUi.root) {
  delete cfg.gateway.controlUi.root;
}

// Repair commonly broken provider config so gateway does not crash-loop.
cfg.models = cfg.models || {};
cfg.models.providers = cfg.models.providers || {};
cfg.models.providers.openai = cfg.models.providers.openai || {};
const rawOpenAiModels = Array.isArray(cfg.models.providers.openai.models)
  ? cfg.models.providers.openai.models
  : [];
const normalizedOpenAiModels = (rawOpenAiModels.length
  ? rawOpenAiModels
  : [{ id: "gpt-4o", name: "gpt-4o" }, { id: "gpt-4o-mini", name: "gpt-4o-mini" }])
  .map((model) => {
    if (typeof model === "string") {
      return { id: model, name: model };
    }
    if (model && typeof model === "object") {
      const id =
        typeof model.id === "string" && model.id.trim().length > 0
          ? model.id
          : typeof model.name === "string" && model.name.trim().length > 0
            ? model.name
            : "gpt-4o";
      const name =
        typeof model.name === "string" && model.name.trim().length > 0
          ? model.name
          : id;
      return { ...model, id, name };
    }
    return { id: "gpt-4o", name: "gpt-4o" };
  });
cfg.models.providers.openai.models = normalizedOpenAiModels;

fs.writeFileSync(path, JSON.stringify(cfg, null, 2));
NODE

if [ "${AUTH_MODE}" = "token" ] && [ -n "${TOKEN}" ]; then
  exec openclaw gateway run --allow-unconfigured --port "${PORT}" --token "${TOKEN}" --tailscale off
fi

exec openclaw gateway run --allow-unconfigured --port "${PORT}" --tailscale off
