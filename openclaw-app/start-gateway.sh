#!/bin/bash
# Patch openclaw config with allowed origins before starting, then run gateway
set -e

CONFIG="$HOME/.openclaw/openclaw.json"
DOMAIN=$(echo "$REPLIT_DOMAINS" | cut -d, -f1)

node << JSEOF
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('${CONFIG}', 'utf8'));

config.gateway.auth = { mode: 'none' };
// Replace controlUi entirely to avoid stale/unrecognised keys
config.gateway.controlUi = {
  allowedOrigins: ['https://${DOMAIN}']
};

fs.writeFileSync('${CONFIG}', JSON.stringify(config, null, 2));
console.log('[start-gateway] Config patched with allowedOrigins=[https://${DOMAIN}]');
JSEOF

fuser -k 3001/tcp 2>/dev/null || true
sleep 1

exec ./node_modules/.bin/openclaw gateway run --allow-unconfigured --port 3001
