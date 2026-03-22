import { createServer } from "http";
import { createProxyMiddleware } from "http-proxy-middleware";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { verifySessionToken } from "./sessionAuth";
import app from "./app";
import { isDbEnabled } from "./localDev";
const GATEWAY_URL = (process.env.OPENCLAW_GATEWAY_URL ?? "http://127.0.0.1:3005").trim();
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN?.trim();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function ensureSchema() {
  if (!isDbEnabled()) {
    console.log("DATABASE_URL not set, starting API server in local no-db mode");
    return;
  }

  try {
    const { pool } = await import("@workspace/db");
    console.log("Ensuring database schema...");
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE message_role AS ENUM ('user', 'assistant');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role message_role NOT NULL,
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
      CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON conversations(user_id);
      CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);
    `);
    await pool.query(`
      CREATE SCHEMA IF NOT EXISTS app;
      CREATE TABLE IF NOT EXISTS app.users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        gateway_enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS app.usage_events (
        id BIGSERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        type TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS app.affiliates (
        id BIGSERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        code TEXT UNIQUE NOT NULL,
        stripe_account_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS app.referral_attributions (
        id BIGSERIAL PRIMARY KEY,
        affiliate_email TEXT NOT NULL,
        referred_email TEXT UNIQUE NOT NULL,
        stripe_customer_id TEXT UNIQUE,
        source_code TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS app.affiliate_commissions (
        id BIGSERIAL PRIMARY KEY,
        affiliate_email TEXT NOT NULL,
        referred_email TEXT NOT NULL,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        stripe_invoice_id TEXT UNIQUE,
        amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'usd',
        status TEXT NOT NULL DEFAULT 'pending',
        stripe_transfer_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        paid_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS usage_events_email_created_idx
        ON app.usage_events (email, created_at DESC);
      CREATE INDEX IF NOT EXISTS affiliates_code_idx
        ON app.affiliates (code);
      CREATE INDEX IF NOT EXISTS referral_attributions_affiliate_email_idx
        ON app.referral_attributions (affiliate_email);
      CREATE INDEX IF NOT EXISTS affiliate_commissions_affiliate_status_idx
        ON app.affiliate_commissions (affiliate_email, status, created_at DESC);
    `);
    console.log("Database schema ready");
  } catch (error) {
    console.error("Failed to ensure database schema:", error);
    throw error;
  }
}

async function initStripe() {
  if (!isDbEnabled()) {
    console.warn("DATABASE_URL not set - skipping Stripe initialization");
    return;
  }

  try {
    const databaseUrl = process.env.DATABASE_URL!;
    console.log("Initializing Stripe schema...");
    await runMigrations({ databaseUrl, schema: "stripe" });
    console.log("Stripe schema ready");

    const { pool } = await import("@workspace/db");
    const syncAccounts = await pool.query(
      `SELECT to_regclass('stripe.accounts')::text AS table_name`,
    );
    const hasStripeAccountsTable = Boolean(syncAccounts.rows[0]?.table_name);
    if (!hasStripeAccountsTable) {
      console.warn(
        "[stripe] stripe-replit-sync tables not present (missing stripe.accounts); skipping managed webhook sync.",
      );
      return;
    }

    const stripeSync = await getStripeSync();

    console.log("Setting up managed webhook...");
    const webhookBaseUrl =
      process.env.APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost"}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    console.log("Webhook configured");

    stripeSync
      .syncBackfill()
      .then(() => {
        console.log("Stripe data synced");
      })
      .catch((err) => {
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
  target: GATEWAY_URL,
  changeOrigin: false,
  ws: true,
  pathRewrite: (incomingPath) => {
    const rewritten = incomingPath.replace(/^\/api\/gateway/, "");
    return rewritten.length > 0 ? rewritten : "/";
  },
  on: {
    proxyReqWs: (proxyReq) => {
      if (GATEWAY_TOKEN) {
        proxyReq.setHeader("authorization", `Bearer ${GATEWAY_TOKEN}`);
      }
    },
  },
});

server.on("upgrade", async (req, socket, head) => {
  if (req.url?.startsWith("/api/gateway")) {
    (wsProxy as any).upgrade(req, socket, head);
    return;
  }

  if (!req.url?.startsWith("/api/instance-proxy")) {
    return;
  }

  if (!isDbEnabled()) {
    socket.destroy();
    return;
  }

  try {
    const cookieHeader = req.headers.cookie || "";
    const sessionMatch = cookieHeader.match(/(?:^|;\s*)__oc_session=([^;]+)/);
    const sessionToken = sessionMatch ? decodeURIComponent(sessionMatch[1]) : null;

    const sessionEmail = sessionToken ? verifySessionToken(sessionToken) : null;

    if (!sessionEmail) {
      socket.destroy();
      return;
    }

    const { db } = await import("@workspace/db");
    const { userAgentsTable } = await import("@workspace/db/schema");
    const { eq } = await import("drizzle-orm");

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
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
