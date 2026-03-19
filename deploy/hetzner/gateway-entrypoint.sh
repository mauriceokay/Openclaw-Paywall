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
      "allowInsecureAuth": true
    }
  }
}
JSON
fi

exec openclaw gateway run --allow-unconfigured --host 0.0.0.0 --port "${PORT}"
