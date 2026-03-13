#!/bin/bash
# Patch openclaw config before starting gateway
set -e

CONFIG="$HOME/.openclaw/openclaw.json"
DOMAIN=$(echo "$REPLIT_DOMAINS" | cut -d, -f1)

node << JSEOF
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('${CONFIG}', 'utf8'));

// No auth required - proxy is the security layer
config.gateway.auth = { mode: 'none' };

// Trust our API server proxy (127.0.0.1) so connections are treated as local,
// which bypasses the "pairing required" check on WebSocket connections
config.gateway.trustedProxies = ['127.0.0.1', '::1'];

// Allow our Replit domain in the control UI
config.gateway.controlUi = {
  allowedOrigins: ['https://${DOMAIN}']
};

fs.writeFileSync('${CONFIG}', JSON.stringify(config, null, 2));
console.log('[start-gateway] Config patched: trustedProxies=127.0.0.1, allowedOrigins=${DOMAIN}');
JSEOF

fuser -k 3001/tcp 2>/dev/null || true
sleep 1

exec ./node_modules/.bin/openclaw gateway run --allow-unconfigured --port 3001
