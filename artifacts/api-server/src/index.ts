import { createServer } from "http";
import { createProxyMiddleware } from "http-proxy-middleware";
import fs from "fs";
import path from "path";
import os from "os";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import app from "./app";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

function getGatewayToken(): string {
  try {
    const configPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return config?.gateway?.auth?.token ?? "";
  } catch {
    return "";
  }
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("DATABASE_URL not set — skipping Stripe initialization");
    return;
  }

  try {
    console.log("Initializing Stripe schema...");
    await runMigrations({ databaseUrl, schema: "stripe" });
    console.log("Stripe schema ready");

    const stripeSync = await getStripeSync();

    console.log("Setting up managed webhook...");
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    console.log("Webhook configured");

    stripeSync.syncBackfill().then(() => {
      console.log("Stripe data synced");
    }).catch((err) => {
      console.error("Error syncing Stripe data:", err);
    });
  } catch (error) {
    console.error("Failed to initialize Stripe:", error);
  }
}

await initStripe();

// Create HTTP server so we can also handle WebSocket upgrades for the gateway proxy
const server = createServer(app);

const wsProxy = createProxyMiddleware({
  target: "http://127.0.0.1:3001",
  changeOrigin: true,
  pathRewrite: { "^/api/gateway": "" },
  on: {
    proxyReq: (proxyReq) => {
      const token = getGatewayToken();
      if (token) proxyReq.setHeader("Authorization", `Bearer ${token}`);
    },
  },
});

server.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/api/gateway")) {
    (wsProxy as any).upgrade(req, socket, head);
  }
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
