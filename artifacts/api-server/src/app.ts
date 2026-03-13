import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createProxyMiddleware, responseInterceptor } from "http-proxy-middleware";
import router from "./routes";
import { WebhookHandlers } from "./webhookHandlers";

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

// Gateway HTTP proxy — serves the real OpenClaw control UI at /api/gateway/*
// Strips X-Frame-Options and frame-ancestors CSP so it can be embedded in our iframe.
// Injects window.__OPENCLAW_CONTROL_UI_BASE_PATH__ so the gateway WS connects at /api/gateway.
const gatewayHttpProxy = createProxyMiddleware<express.Request, express.Response>({
  target: "http://127.0.0.1:3001",
  changeOrigin: true,
  selfHandleResponse: true,
  pathRewrite: { "^/api/gateway": "" },
  on: {
    proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
      // Strip iframe-blocking headers
      res.removeHeader("x-frame-options");
      const csp = res.getHeader("content-security-policy");
      if (typeof csp === "string") {
        const relaxed = csp
          .replace(/frame-ancestors[^;]*(;|$)/g, "")
          .replace(/frame-src[^;]*(;|$)/g, "");
        res.setHeader("content-security-policy", relaxed);
      }

      // Inject base path into HTML so the gateway WS connects via /api/gateway
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

app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
