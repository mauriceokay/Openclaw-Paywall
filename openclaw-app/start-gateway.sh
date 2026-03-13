#!/bin/bash
# Patch openclaw config before starting gateway
set -e

CONFIG="$HOME/.openclaw/openclaw.json"
DOMAIN=$(echo "$REPLIT_DOMAINS" | cut -d, -f1)

# Wire the Replit AI integration credentials so OpenClaw can call Claude
export ANTHROPIC_API_KEY="${AI_INTEGRATIONS_ANTHROPIC_API_KEY}"
export ANTHROPIC_BASE_URL="${AI_INTEGRATIONS_ANTHROPIC_BASE_URL}"

node << JSEOF
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('${CONFIG}', 'utf8'));

// No auth required - proxy is the security layer
config.gateway.auth = { mode: 'none' };

// Trust our API server proxy (127.0.0.1)
config.gateway.trustedProxies = ['127.0.0.1', '::1'];

// Allow our Replit domain in the control UI
// allowInsecureAuth: true — switches to token-only mode so the browser
// doesn't need a device-identity cookie (which can't survive the proxy hop).
// With this set, ?session=TOKEN in the URL is sufficient to connect.
config.gateway.controlUi = {
  allowedOrigins: ['https://${DOMAIN}'],
  allowInsecureAuth: true
};

fs.writeFileSync('${CONFIG}', JSON.stringify(config, null, 2));
console.log('[start-gateway] Config patched: allowInsecureAuth=true, allowedOrigins=${DOMAIN}');
JSEOF

fuser -k 3001/tcp 2>/dev/null || true
sleep 1

exec ./node_modules/.bin/openclaw gateway run --allow-unconfigured --port 3001
