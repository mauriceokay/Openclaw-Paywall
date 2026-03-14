import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createProxyMiddleware, responseInterceptor } from "http-proxy-middleware";
import { db } from "@workspace/db";
import { userAgentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import router from "./routes";
import { WebhookHandlers } from "./webhookHandlers";
import { getSessionEmail } from "./sessionAuth";

const app: Express = express();

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
  target: "http://127.0.0.1:3001",
  changeOrigin: true,
  selfHandleResponse: true,
  pathRewrite: { "^/api/gateway": "" },
  on: {
    proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
      res.removeHeader("x-frame-options");
      const csp = res.getHeader("content-security-policy");
      if (typeof csp === "string") {
        const relaxed = csp
          .replace(/frame-ancestors[^;]*(;|$)/g, "")
          .replace(/frame-src[^;]*(;|$)/g, "");
        res.setHeader("content-security-policy", relaxed);
      }

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

app.use("/api/gateway", gatewayHttpProxy);

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
  const sessionEmail = getSessionEmail(req);

  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
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
        proxyRes: responseInterceptor(async (responseBuffer, proxyRes, _req, proxyResExpress) => {
          stripIframeHeaders(proxyResExpress as unknown as express.Response);

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
  } catch (err: any) {
    console.error("[instance-proxy] error:", err.message);
    return res.status(500).json({ error: "Proxy error" });
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
