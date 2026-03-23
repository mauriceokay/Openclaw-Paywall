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
const bundledControlUiIndex = "/usr/local/lib/node_modules/openclaw/dist/control-ui/index.html";
const fallbackControlUiRoot = "/usr/local/lib/node_modules/openclaw/dist/canvas-host/a2ui";
if (!fs.existsSync(bundledControlUiIndex) && fs.existsSync(`${fallbackControlUiRoot}/index.html`)) {
  cfg.gateway.controlUi.root = fallbackControlUiRoot;
} else if (cfg.gateway.controlUi.root === fallbackControlUiRoot) {
  // If bundled Control UI exists again (fixed package), remove emergency canvas override.
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

exec openclaw gateway run --allow-unconfigured --port "${PORT}"
