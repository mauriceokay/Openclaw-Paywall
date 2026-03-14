import { createServer } from "http";
import { createProxyMiddleware } from "http-proxy-middleware";
import { runMigrations } from "stripe-replit-sync";
import { db } from "@workspace/db";
import { userAgentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
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

const server = createServer(app);

const wsProxy = createProxyMiddleware({
  target: "http://127.0.0.1:3001",
  changeOrigin: true,
  pathRewrite: { "^/api/gateway": "" },
});

server.on("upgrade", async (req, socket, head) => {
  if (req.url?.startsWith("/api/gateway")) {
    (wsProxy as any).upgrade(req, socket, head);
  } else if (req.url?.startsWith("/api/instance-proxy")) {
    try {
      const urlObj = new URL(req.url, "http://localhost");
      let userId = urlObj.searchParams.get("userId");

      if (!userId) {
        const cookieHeader = req.headers.cookie || "";
        const match = cookieHeader.match(/(?:^|;\s*)__oc_proxy_user=([^;]+)/);
        userId = match ? decodeURIComponent(match[1]) : null;
      }

      if (!userId) {
        socket.destroy();
        return;
      }

      const rows = await db
        .select()
        .from(userAgentsTable)
        .where(eq(userAgentsTable.userId, userId))
        .limit(1);

      if (rows.length === 0 || !rows[0].instanceUrl) {
        socket.destroy();
        return;
      }

      const instanceProxy = createProxyMiddleware({
        target: rows[0].instanceUrl,
        changeOrigin: true,
        pathRewrite: { "^/api/instance-proxy": "" },
      });

      (instanceProxy as any).upgrade(req, socket, head);
    } catch (err) {
      console.error("[instance-proxy] WS upgrade error:", err);
      socket.destroy();
    }
  }
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
