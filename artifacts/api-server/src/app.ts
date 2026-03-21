import { existsSync } from "fs";
import path from "path";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createProxyMiddleware, responseInterceptor } from "http-proxy-middleware";
import router from "./routes";
import { WebhookHandlers } from "./webhookHandlers";
import { getSessionEmail } from "./sessionAuth";
import { getLocalAgent, isDbEnabled } from "./localDev";
import { trackUsageEvent } from "./usageTracking";

const app: Express = express();
// Respect X-Forwarded-* headers from Caddy/edge proxy so req.protocol is accurate
// (required for generating wss:// gateway URLs on HTTPS domains).
app.set("trust proxy", 1);
const GATEWAY_URL = (process.env.OPENCLAW_GATEWAY_URL ?? "http://127.0.0.1:3005").trim();
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN?.trim();
const MISSION_CONTROL_BACKEND_URL = process.env.MISSION_CONTROL_BACKEND_URL ?? "http://127.0.0.1:8001";
const MISSION_CONTROL_FRONTEND_URL = process.env.MISSION_CONTROL_FRONTEND_URL ?? "http://127.0.0.1:3002";
const PAPERCLIP_URL = process.env.PAPERCLIP_URL ?? "http://127.0.0.1:3100";

app.get("/health", (_req, res) => {
  res.json({ status: "ok", gatewayUrl: GATEWAY_URL });
});

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      return res.status(400).json({ error: "Missing stripe-signature" });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        console.error("STRIPE WEBHOOK ERROR: req.body is not a Buffer");
        return res.status(500).json({ error: "Webhook processing error" });
      }

      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error.message);
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

const gatewayHttpProxy = createProxyMiddleware<express.Request, express.Response>({
  target: GATEWAY_URL,
  changeOrigin: false,
  ws: true,
  selfHandleResponse: true,
  pathRewrite: (incomingPath) => {
    const rewritten = incomingPath.replace(/^\/api\/gateway/, "");
    return rewritten.length > 0 ? rewritten : "/";
  },
  on: {
    proxyReq: (proxyReq) => {
      if (GATEWAY_TOKEN) {
        proxyReq.setHeader("authorization", `Bearer ${GATEWAY_TOKEN}`);
      }
    },
    proxyRes: responseInterceptor(async (responseBuffer, proxyRes, _req, expressRes) => {
      stripIframeHeaders(expressRes as express.Response);

      const contentType = (proxyRes.headers["content-type"] ?? "") as string;
      if (contentType.includes("text/html")) {
        let html = responseBuffer.toString("utf8");
        const injection = `<script>window.__OPENCLAW_CONTROL_UI_BASE_PATH__ = "/api/gateway";</script>`;
        html = html.includes("<head>")
          ? html.replace("<head>", `<head>${injection}`)
          : `${injection}${html}`;
        return Buffer.from(html, "utf8");
      }

      return responseBuffer;
    }),
  },
});

app.use("/api/gateway", cookieParser(), async (req, _res, next) => {
  if (req.method === "GET" && req.path === "/chat") {
    const sessionEmail = getSessionEmail(req);
    if (sessionEmail) {
      await trackUsageEvent(sessionEmail, "terminal_open", { source: "gateway_chat_route" });
    }
  }
  next();
}, gatewayHttpProxy);

// Fallback: some local routes can land on /chat without the /api/gateway prefix.
// Redirecting keeps the control UI reachable instead of showing a proxy failure.
app.get("/chat", (req, res) => {
  const rawQuery = req.url.includes("?") ? req.url.slice(req.url.indexOf("?") + 1) : "";
  const params = new URLSearchParams(rawQuery);

  const appUrl = process.env.APP_URL?.trim();
  let defaultGatewayUrl: string | null = null;
  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      const wsProto = parsed.protocol === "https:" ? "wss:" : "ws:";
      defaultGatewayUrl = `${wsProto}//${parsed.host}/api/gateway`;
    } catch {}
  }
  if (!defaultGatewayUrl) {
    const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
    const isHttps = req.protocol === "https" || forwardedProto === "https";
    const proto = isHttps ? "wss" : "ws";
    const host = req.get("host");
    if (host?.trim()) {
      defaultGatewayUrl = `${proto}://${host}/api/gateway`;
    }
  }

  const currentGatewayUrl = params.get("gatewayUrl");
  if (!currentGatewayUrl && defaultGatewayUrl) {
    params.set("gatewayUrl", defaultGatewayUrl);
  } else if (currentGatewayUrl?.startsWith("ws://")) {
    const shouldForceSecureWs = appUrl?.startsWith("https://") || req.protocol === "https";
    if (shouldForceSecureWs) {
      params.set("gatewayUrl", currentGatewayUrl.replace(/^ws:\/\//i, "wss://"));
    }
  }

  const suffix = params.toString();
  res.redirect(302, `/api/gateway/chat${suffix ? `?${suffix}` : ""}`);
});

// Inject verified user identity for proxy auth mode.
// Strip any client-supplied X-OC-User-* headers first to prevent forgery,
// then re-inject based on the validated session cookie.
app.use("/mc-api", cookieParser(), (req, _res, next) => {
  delete req.headers["x-oc-user-email"];
  delete req.headers["x-oc-user-name"];
  const sessionEmail = getSessionEmail(req);
  if (sessionEmail) {
    req.headers["x-oc-user-email"] = sessionEmail;
  }
  // Backward compatibility: older dashboard bundles still call
  // /api/v1/skills/catalog while the backend now serves
  // /api/v1/skills/marketplace.
  if (typeof req.url === "string" && req.url.startsWith("/api/v1/skills/catalog")) {
    req.url = req.url.replace("/api/v1/skills/catalog", "/api/v1/skills/marketplace");
  }
  next();
});

const mcBackendProxy = createProxyMiddleware<express.Request, express.Response>({
  target: MISSION_CONTROL_BACKEND_URL,
  changeOrigin: true,
  pathRewrite: { "^/mc-api": "" },
});

app.use("/mc-api", mcBackendProxy);

const mcFrontendProxy = createProxyMiddleware<express.Request, express.Response>({
  target: MISSION_CONTROL_FRONTEND_URL,
  changeOrigin: true,
  ws: true,
  pathRewrite: (p) => (p === "/" ? "/mission-control" : `/mission-control${p}`),
});

app.use("/mission-control", mcFrontendProxy);

const paperclipProxy = createProxyMiddleware<express.Request, express.Response>({
  target: PAPERCLIP_URL,
  changeOrigin: true,
  ws: true,
  selfHandleResponse: true,
  pathRewrite: { "^/paperclip": "" },
  on: {
    proxyRes: responseInterceptor(async (responseBuffer, _proxyRes, _req, expressRes) => {
      stripIframeHeaders(expressRes as express.Response);
      return responseBuffer;
    }),
  },
});

app.use("/paperclip", cookieParser(), (req, res, next) => {
  if (!getSessionEmail(req)) {
    return res.status(401).json({ error: "Authentication required" });
  }
  return next();
}, paperclipProxy);

const paperclipPassthroughProxy = createProxyMiddleware<express.Request, express.Response>({
  target: PAPERCLIP_URL,
  changeOrigin: true,
  ws: true,
  selfHandleResponse: true,
  on: {
    proxyRes: responseInterceptor(async (responseBuffer, _proxyRes, _req, expressRes) => {
      stripIframeHeaders(expressRes as express.Response);
      return responseBuffer;
    }),
  },
});

function isPaperclipFallbackPath(pathname: string): boolean {
  const first = pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
  if (!first) return false;
  if (first.startsWith("api")) return false;

  const reserved = new Set([
    "health",
    "mission-control",
    "mc-api",
    "paperclip",
    "openclaw",
    "dashboard",
    "pricing",
    "setup",
    "signup",
    "sign-in",
    "blog",
    "usage",
    "subscription",
    "assets",
    "favicon.ico",
  ]);

  return !reserved.has(first);
}

function isPaperclipRootFromEmbeddedFlow(req: express.Request): boolean {
  if (req.path !== "/") return false;
  const referer = typeof req.headers.referer === "string" ? req.headers.referer : "";
  const fromPaperclipRoute = referer.includes("/paperclip") || referer.includes("/paperclip-app");
  const forcedByQuery = req.query.paperclip === "1";
  return fromPaperclipRoute || forcedByQuery;
}

app.use(cookieParser(), (req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next();
  }
  const shouldUseFallback = isPaperclipFallbackPath(req.path) || isPaperclipRootFromEmbeddedFlow(req);
  if (!shouldUseFallback) {
    return next();
  }
  if (!getSessionEmail(req)) {
    return next();
  }
  return paperclipPassthroughProxy(req, res, next);
});

function stripIframeHeaders(res: express.Response) {
  res.removeHeader("x-frame-options");
  const csp = res.getHeader("content-security-policy");
  if (typeof csp === "string") {
    const relaxed = csp
      .replace(/frame-ancestors[^;]*(;|$)/g, "")
      .replace(/frame-src[^;]*(;|$)/g, "");
    res.setHeader("content-security-policy", relaxed);
  }
}

app.use(cookieParser());

app.use("/api/instance-proxy", async (req, res, next) => {
  if (!isDbEnabled()) {
    const sessionEmail = getSessionEmail(req);
    if (!sessionEmail) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const agent = getLocalAgent(sessionEmail);
    if (!agent?.instanceUrl) {
      return res.status(404).json({ error: "No local instance URL configured for this user" });
    }

    const proxy = createProxyMiddleware<express.Request, express.Response>({
      target: agent.instanceUrl,
      changeOrigin: true,
      selfHandleResponse: true,
      pathRewrite: { "^/api/instance-proxy": "" },
      on: {
        proxyRes: responseInterceptor(async (responseBuffer, proxyRes, _req, expressRes) => {
          stripIframeHeaders(expressRes as express.Response);

          const contentType = (proxyRes.headers["content-type"] ?? "") as string;
          if (contentType.includes("text/html")) {
            let html = responseBuffer.toString("utf8");
            const injection = `<script>window.__OPENCLAW_CONTROL_UI_BASE_PATH__ = "/api/instance-proxy";</script>`;
            html = html.includes("<head>")
              ? html.replace("<head>", `<head>${injection}`)
              : `${injection}${html}`;
            return Buffer.from(html, "utf8");
          }

          return responseBuffer;
        }),
      },
    });

    return proxy(req, res, next);
  }

  const sessionEmail = getSessionEmail(req);

  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const { db } = await import("@workspace/db");
    const { userAgentsTable } = await import("@workspace/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(userAgentsTable)
      .where(eq(userAgentsTable.userId, sessionEmail))
      .limit(1);

    if (rows.length === 0 || !rows[0].instanceUrl) {
      return res.status(404).json({ error: "No instance URL configured for this user" });
    }

    const targetUrl = rows[0].instanceUrl;

    const proxy = createProxyMiddleware<express.Request, express.Response>({
      target: targetUrl,
      changeOrigin: true,
      selfHandleResponse: true,
      pathRewrite: { "^/api/instance-proxy": "" },
      on: {
        proxyRes: responseInterceptor(async (responseBuffer, proxyRes, _req, expressRes) => {
          stripIframeHeaders(expressRes as express.Response);

          const contentType = (proxyRes.headers["content-type"] ?? "") as string;
          if (contentType.includes("text/html")) {
            let html = responseBuffer.toString("utf8");
            const injection = `<script>window.__OPENCLAW_CONTROL_UI_BASE_PATH__ = "/api/instance-proxy";</script>`;
            html = html.includes("<head>")
              ? html.replace("<head>", `<head>${injection}`)
              : `${injection}${html}`;
            return Buffer.from(html, "utf8");
          }

          return responseBuffer;
        }),
      },
    });

    return proxy(req, res, next);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Proxy error";
    console.error("[instance-proxy] error:", message);
    return res.status(500).json({ error: "Proxy error" });
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const frontendDistCandidates = [
  path.resolve(process.cwd(), "artifacts/openclaw/dist/public"),
  path.resolve(process.cwd(), "artifacts/openclaw/dist/artifacts/openclaw/dist/public"),
];
const frontendDist = frontendDistCandidates.find((candidate) => existsSync(candidate)) ?? frontendDistCandidates[0];

if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { maxAge: "1h" }));

  app.use((req, res, next) => {
    if ((req.method === "GET" || req.method === "HEAD") && !req.path.startsWith("/api/") && !req.path.startsWith("/health") && !req.path.startsWith("/mission-control") && !req.path.startsWith("/mc-api") && !req.path.startsWith("/paperclip")) {
      return res.sendFile(path.join(frontendDist, "index.html"));
    }
    next();
  });
}

export default app;
