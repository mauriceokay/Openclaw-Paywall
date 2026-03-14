import crypto from "crypto";
import { createServer } from "http";
import { createProxyMiddleware } from "http-proxy-middleware";
import { runMigrations } from "stripe-replit-sync";
import { db, pool } from "@workspace/db";
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

async function ensureSchema() {
  try {
    console.log("Ensuring database schema...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS user_agents (
        user_id TEXT PRIMARY KEY,
        agent_name TEXT NOT NULL,
        workspace_dir TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        instance_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app.users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        gateway_enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE app.users ADD COLUMN IF NOT EXISTS gateway_enabled BOOLEAN NOT NULL DEFAULT true;
    `);
    console.log("Database schema ready");
  } catch (error) {
    console.error("Failed to ensure database schema:", error);
    throw error;
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
    const webhookBaseUrl = process.env.APP_URL
      || `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost"}`;
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

await ensureSchema();
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
      const cookieHeader = req.headers.cookie || "";
      const sessionMatch = cookieHeader.match(/(?:^|;\s*)__oc_session=([^;]+)/);
      const sessionToken = sessionMatch ? decodeURIComponent(sessionMatch[1]) : null;

      let sessionEmail: string | null = null;
      if (sessionToken) {
        const SESSION_SECRET = process.env.SESSION_SECRET || "";
        const parts = sessionToken.split("|");
        if (parts.length === 3) {
          const [email, expiresAtStr, providedSig] = parts;
          const payload = `${email}|${expiresAtStr}`;
          const hmac = crypto.createHmac("sha256", SESSION_SECRET);
          hmac.update(payload);
          const expectedSig = hmac.digest("hex");
          try {
            if (crypto.timingSafeEqual(Buffer.from(providedSig, "hex"), Buffer.from(expectedSig, "hex"))) {
              if (Date.now() <= parseInt(expiresAtStr, 10)) {
                sessionEmail = email;
              }
            }
          } catch {}
        }
      }

      if (!sessionEmail) {
        socket.destroy();
        return;
      }

      const rows = await db
        .select()
        .from(userAgentsTable)
        .where(eq(userAgentsTable.userId, sessionEmail))
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
