#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="/root/.openclaw"
CONFIG_FILE="${CONFIG_DIR}/openclaw.json"
PORT="${OPENCLAW_GATEWAY_PORT:-3005}"

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
fs.writeFileSync(path, JSON.stringify(cfg, null, 2));
NODE

exec openclaw gateway run --allow-unconfigured --port "${PORT}"
