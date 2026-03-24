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
function resolveGatewayToken(raw: string | undefined): string | null {
  const token = raw?.trim();
  if (!token) return null;
  return token;
}
const GATEWAY_TOKEN = resolveGatewayToken(process.env.OPENCLAW_GATEWAY_TOKEN);
const MISSION_CONTROL_BACKEND_URL = process.env.MISSION_CONTROL_BACKEND_URL ?? "http://127.0.0.1:8001";
const MISSION_CONTROL_FRONTEND_URL = process.env.MISSION_CONTROL_FRONTEND_URL ?? "http://127.0.0.1:3002";
const PAPERCLIP_URL = process.env.PAPERCLIP_URL ?? "http://127.0.0.1:3100";
const SUPPORTED_EMBED_LOCALES = new Set(["en", "de", "fr", "it", "pl", "ja", "ko", "ar", "ms", "zh-CN", "zh-TW"]);

function normalizeEmbeddedLocale(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "en";

  if (SUPPORTED_EMBED_LOCALES.has(value)) return value;

  const lower = value.toLowerCase();
  if (lower.startsWith("zh-cn") || lower === "zh" || lower === "zh-hans") return "zh-CN";
  if (lower.startsWith("zh-tw") || lower.startsWith("zh-hk") || lower === "zh-hant") return "zh-TW";
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("ko")) return "ko";
  if (lower.startsWith("de")) return "de";
  if (lower.startsWith("fr")) return "fr";
  if (lower.startsWith("it")) return "it";
  if (lower.startsWith("pl")) return "pl";
  if (lower.startsWith("ar")) return "ar";
  if (lower.startsWith("ms")) return "ms";
  return "en";
}

function resolveEmbeddedLocale(req: express.Request): string {
  const fromQuery = typeof req.query.oc_lang === "string" ? req.query.oc_lang : null;
  const fromCookie = typeof req.cookies?.oc_locale === "string" ? req.cookies.oc_locale : null;
  const fromHeader = req.get("accept-language")?.split(",")[0] ?? null;
  return normalizeEmbeddedLocale(fromQuery ?? fromCookie ?? fromHeader);
}

function setLocaleHeaders(proxyReq: { setHeader: (name: string, value: string) => void }, req: express.Request): void {
  const locale = resolveEmbeddedLocale(req);
  proxyReq.setHeader("accept-language", locale);
  proxyReq.setHeader("x-oc-locale", locale);
}

function buildLocaleBridgeScript(locale: string, target: "openclaw" | "paperclip"): string {
  const openClawTranslations: Record<string, Record<string, string>> = {
    de: {
      "Gateway Dashboard": "Gateway-Dashboard",
      "WebSocket URL": "WebSocket-URL",
      "Password (not stored)": "Passwort (nicht gespeichert)",
      optional: "optional",
      Connect: "Verbinden",
      "How to connect": "So verbindest du dich",
      "Read the docs \u2192": "Dokumentation lesen \u2192",
    },
    fr: {
      "Gateway Dashboard": "Tableau de bord Gateway",
      "WebSocket URL": "URL WebSocket",
      "Password (not stored)": "Mot de passe (non enregistr\u00e9)",
      optional: "optionnel",
      Connect: "Se connecter",
      "How to connect": "Comment se connecter",
      "Read the docs \u2192": "Lire la documentation \u2192",
    },
    it: {
      "Gateway Dashboard": "Dashboard Gateway",
      "WebSocket URL": "URL WebSocket",
      "Password (not stored)": "Password (non salvata)",
      optional: "opzionale",
      Connect: "Connetti",
      "How to connect": "Come connettersi",
      "Read the docs \u2192": "Leggi la documentazione \u2192",
    },
    pl: {
      "Gateway Dashboard": "Panel bramy",
      "WebSocket URL": "Adres WebSocket",
      "Password (not stored)": "Has\u0142o (niezapisywane)",
      optional: "opcjonalne",
      Connect: "Po\u0142\u0105cz",
      "How to connect": "Jak si\u0119 po\u0142\u0105czy\u0107",
      "Read the docs \u2192": "Przeczytaj dokumentacj\u0119 \u2192",
    },
    ja: {
      "Gateway Dashboard": "\u30b2\u30fc\u30c8\u30a6\u30a7\u30a4\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9",
      "WebSocket URL": "WebSocket URL",
      "Password (not stored)": "\u30d1\u30b9\u30ef\u30fc\u30c9\uff08\u4fdd\u5b58\u3055\u308c\u307e\u305b\u3093\uff09",
      optional: "\u4efb\u610f",
      Connect: "\u63a5\u7d9a",
      "How to connect": "\u63a5\u7d9a\u65b9\u6cd5",
      "Read the docs \u2192": "\u30c9\u30ad\u30e5\u30e1\u30f3\u30c8\u3092\u8aad\u3080 \u2192",
      Control: "\u30b3\u30f3\u30c8\u30ed\u30fc\u30eb",
      "\u30b9\u30c6\u30a2\u30a6\u30f3\u30b0": "\u30b3\u30f3\u30c8\u30ed\u30fc\u30eb",
      "\u30b9\u30c6\u30a2\u30a6\u30a2\u30f3\u30b0": "\u30b3\u30f3\u30c8\u30ed\u30fc\u30eb",
      "Steuerung": "\u30b3\u30f3\u30c8\u30ed\u30fc\u30eb",
      Overview: "\u6982\u8981",
      "\u00dcbersicht": "\u6982\u8981",
      Channels: "\u30c1\u30e3\u30f3\u30cd\u30eb",
      "Kan\u00e4le": "\u30c1\u30e3\u30f3\u30cd\u30eb",
      Instances: "\u30a4\u30f3\u30b9\u30bf\u30f3\u30b9",
      Instanzen: "\u30a4\u30f3\u30b9\u30bf\u30f3\u30b9",
      Sessions: "\u30bb\u30c3\u30b7\u30e7\u30f3",
      Sitzungen: "\u30bb\u30c3\u30b7\u30e7\u30f3",
      Usage: "\u4f7f\u7528\u91cf",
      Nutzung: "\u4f7f\u7528\u91cf",
      "Cron Jobs": "Cron\u30b8\u30e7\u30d6",
      "Cron-Aufgaben": "Cron\u30b8\u30e7\u30d6",
      Agent: "\u30a8\u30fc\u30b8\u30a7\u30f3\u30c8",
      Agents: "\u30a8\u30fc\u30b8\u30a7\u30f3\u30c8",
      Agenten: "\u30a8\u30fc\u30b8\u30a7\u30f3\u30c8",
      Skills: "\u30b9\u30ad\u30eb",
      "F\u00e4higkeiten": "\u30b9\u30ad\u30eb",
      Devices: "\u30c7\u30d0\u30a4\u30b9",
      "Ger\u00e4te": "\u30c7\u30d0\u30a4\u30b9",
      Settings: "\u8a2d\u5b9a",
      Einstellungen: "\u8a2d\u5b9a",
      Configuration: "\u69cb\u6210",
      Konfiguration: "\u69cb\u6210",
      Communications: "\u30b3\u30df\u30e5\u30cb\u30b1\u30fc\u30b7\u30e7\u30f3",
      Appearance: "\u5916\u89b3",
      Automation: "\u81ea\u52d5\u5316",
      Infrastructure: "\u30a4\u30f3\u30d5\u30e9",
      "AI & Agents": "AI\u3068\u30a8\u30fc\u30b8\u30a7\u30f3\u30c8",
      Debug: "\u30c7\u30d0\u30c3\u30b0",
      Logs: "\u30ed\u30b0",
      Protokolle: "\u30ed\u30b0",
      Chat: "\u30c1\u30e3\u30c3\u30c8",
    },
    ko: {
      "Gateway Dashboard": "\uac8c\uc774\ud2b8\uc6e8\uc774 \ub300\uc2dc\ubcf4\ub4dc",
      "WebSocket URL": "WebSocket URL",
      "Password (not stored)": "\ube44\ubc00\ubc88\ud638 (\uc800\uc7a5\ub418\uc9c0 \uc54a\uc74c)",
      optional: "\uc120\ud0dd",
      Connect: "\uc5f0\uacb0",
      "How to connect": "\uc5f0\uacb0 \ubc29\ubc95",
      "Read the docs \u2192": "\ubb38\uc11c \ubcf4\uae30 \u2192",
    },
  };

  const paperclipTranslations: Record<string, Record<string, string>> = {
    de: {
      "Sign in to Paperclip": "Bei Paperclip anmelden",
      "Use your email and password to access this instance.": "Nutze deine E-Mail und dein Passwort, um auf diese Instanz zuzugreifen.",
      Email: "E-Mail",
      Password: "Passwort",
      "Sign In": "Anmelden",
      "Need an account? Create one": "Noch kein Konto? Konto erstellen",
      "Create one": "Konto erstellen",
      "Instance setup required": "Instanz-Einrichtung erforderlich",
    },
    fr: {
      "Sign in to Paperclip": "Connexion \u00e0 Paperclip",
      "Use your email and password to access this instance.": "Utilisez votre e-mail et votre mot de passe pour acc\u00e9der \u00e0 cette instance.",
      Email: "E-mail",
      Password: "Mot de passe",
      "Sign In": "Se connecter",
      "Need an account? Create one": "Besoin d'un compte ? Cr\u00e9ez-en un",
      "Create one": "Cr\u00e9er un compte",
      "Instance setup required": "Configuration de l'instance requise",
    },
    it: {
      "Sign in to Paperclip": "Accedi a Paperclip",
      "Use your email and password to access this instance.": "Usa email e password per accedere a questa istanza.",
      Email: "Email",
      Password: "Password",
      "Sign In": "Accedi",
      "Need an account? Create one": "Hai bisogno di un account? Creane uno",
      "Create one": "Crea account",
      "Instance setup required": "Configurazione istanza richiesta",
    },
    pl: {
      "Sign in to Paperclip": "Zaloguj si\u0119 do Paperclip",
      "Use your email and password to access this instance.": "U\u017cyj e-maila i has\u0142a, aby uzyska\u0107 dost\u0119p do tej instancji.",
      Email: "E-mail",
      Password: "Has\u0142o",
      "Sign In": "Zaloguj si\u0119",
      "Need an account? Create one": "Potrzebujesz konta? Utw\u00f3rz je",
      "Create one": "Utw\u00f3rz konto",
      "Instance setup required": "Wymagana konfiguracja instancji",
    },
    ja: {
      "Sign in to Paperclip": "Paperclip \u306b\u30b5\u30a4\u30f3\u30a4\u30f3",
      "Use your email and password to access this instance.": "\u3053\u306e\u30a4\u30f3\u30b9\u30bf\u30f3\u30b9\u306b\u30a2\u30af\u30bb\u30b9\u3059\u308b\u306b\u306f\u3001\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9\u3068\u30d1\u30b9\u30ef\u30fc\u30c9\u3092\u4f7f\u7528\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
      Email: "\u30e1\u30fc\u30eb",
      Password: "\u30d1\u30b9\u30ef\u30fc\u30c9",
      "Sign In": "\u30b5\u30a4\u30f3\u30a4\u30f3",
      "Need an account? Create one": "\u30a2\u30ab\u30a6\u30f3\u30c8\u304c\u5fc5\u8981\u3067\u3059\u304b\uff1f\u4f5c\u6210\u3059\u308b",
      "Create one": "\u4f5c\u6210\u3059\u308b",
      "Instance setup required": "\u30a4\u30f3\u30b9\u30bf\u30f3\u30b9\u306e\u30bb\u30c3\u30c8\u30a2\u30c3\u30d7\u304c\u5fc5\u8981\u3067\u3059",
    },
    ko: {
      "Sign in to Paperclip": "Paperclip\uc5d0 \ub85c\uadf8\uc778",
      "Use your email and password to access this instance.": "\uc774 \uc778\uc2a4\ud134\uc2a4\uc5d0 \uc811\uadfc\ud558\ub824\uba74 \uc774\uba54\uc77c\uacfc \ube44\ubc00\ubc88\ud638\ub97c \uc0ac\uc6a9\ud558\uc138\uc694.",
      Email: "\uc774\uba54\uc77c",
      Password: "\ube44\ubc00\ubc88\ud638",
      "Sign In": "\ub85c\uadf8\uc778",
      "Need an account? Create one": "\uacc4\uc815\uc774 \ud544\uc694\ud55c\uac00\uc694? \ub9cc\ub4e4\uae30",
      "Create one": "\uacc4\uc815 \ub9cc\ub4e4\uae30",
      "Instance setup required": "\uc778\uc2a4\ud134\uc2a4 \uc124\uc815\uc774 \ud544\uc694\ud569\ub2c8\ub2e4",
    },
  };

  const selected = target === "paperclip" ? paperclipTranslations[locale] ?? {} : openClawTranslations[locale] ?? {};

  const script = `
<script>
  (function() {
    try {
      var locale = ${JSON.stringify(locale)};
      var target = ${JSON.stringify(target)};
      var translations = ${JSON.stringify(selected)};
      document.documentElement.lang = locale;

      if (target === "openclaw") {
        var keys = ["openclaw.locale", "openclaw.control.locale", "openclaw.control.language", "oc.locale"];
        keys.forEach(function(k) { try { localStorage.setItem(k, locale); } catch (_e) {} });
        try {
          var raw = localStorage.getItem("openclaw.control.settings.v1");
          if (raw) {
            var parsed = JSON.parse(raw);
            parsed.locale = locale;
            parsed.lang = locale;
            parsed.language = locale;
            localStorage.setItem("openclaw.control.settings.v1", JSON.stringify(parsed));
          }
        } catch (_err) {}
      }

      if (!translations || Object.keys(translations).length === 0) return;

      var replace = function() {
        try {
          var nodes = document.querySelectorAll("body *");
          nodes.forEach(function(node) {
            if (!node) return;
            if (node.childElementCount === 0) {
              var text = (node.textContent || "").trim();
              if (text && translations[text]) node.textContent = translations[text];
            }
            var aria = node.getAttribute && node.getAttribute("aria-label");
            if (aria && translations[aria]) node.setAttribute("aria-label", translations[aria]);
            if (node instanceof HTMLInputElement) {
              var ph = (node.placeholder || "").trim();
              if (ph && translations[ph]) node.placeholder = translations[ph];
              var value = (node.value || "").trim();
              if (value && translations[value]) node.value = translations[value];
            }
          });
        } catch (_err) {}
      };

      replace();
      var observer = new MutationObserver(function() { replace(); });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_err) {}
  })();
</script>`;

  return script;
}

function resolvePublicGatewayWsUrl(req: express.Request): string | null {
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      const wsProto = parsed.protocol === "https:" ? "wss:" : "ws:";
      return `${wsProto}//${parsed.host}/api/gateway`;
    } catch {}
  }

  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const isHttps = req.protocol === "https" || forwardedProto === "https";
  const wsProto = isHttps ? "wss" : "ws";
  const host = req.get("host");
  if (!host?.trim()) return null;
  return `${wsProto}://${host}/api/gateway`;
}

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

const gatewayChatProxy = createProxyMiddleware<express.Request, express.Response>({
  target: GATEWAY_URL,
  changeOrigin: false,
  pathRewrite: { "^/api/gateway": "" },
  selfHandleResponse: true,
  on: {
    proxyReq: (proxyReq, req) => {
      setLocaleHeaders(proxyReq, req);
    },
    proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, expressRes) => {
      stripIframeHeaders(expressRes as express.Response);

      const contentType = (proxyRes.headers["content-type"] ?? "") as string;
      const looksLikeHtml = responseBuffer.toString("utf8", 0, 512).toLowerCase().includes("<html");
      if (contentType.includes("text/html") || (req.path.includes("/chat") && looksLikeHtml)) {
        let html = responseBuffer.toString("utf8");
        const locale = resolveEmbeddedLocale(req);
        const uiVersion = (process.env.OPENCLAW_UI_VERSION ?? "20260324").trim();
        html = html.replace(/a2ui\.bundle\.js(\?[^"']*)?/g, `a2ui.bundle.js?ocv=${encodeURIComponent(uiVersion)}`);
        const tokenScript = `
<script>
  (function() {
    var envToken = ${JSON.stringify(GATEWAY_TOKEN ?? "")};
    var queryParams = new URLSearchParams(window.location.search);
    var hashParams = new URLSearchParams(window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash);
    var token = (queryParams.get("token") || hashParams.get("token") || envToken || "").trim();
    if (!token) return;
    window.__OC_GATEWAY_TOKEN__ = token;
    var params = new URLSearchParams(window.location.search);
    var gatewayUrl = params.get("gatewayUrl");
    if (!gatewayUrl) {
      gatewayUrl =
        (window.location.protocol === "https:" ? "wss" : "ws") +
        "://" +
        window.location.host +
        "/api/gateway";
    }
    try {
      var parsed = new URL(gatewayUrl, window.location.href);
      var pathname = parsed.pathname === "/" ? "" : (parsed.pathname.replace(/\\/+$/, "") || parsed.pathname);
      var scope = parsed.protocol + "//" + parsed.host + pathname;
      sessionStorage.setItem("openclaw.control.token.v1:" + scope, token);
    } catch (_err) {
      sessionStorage.setItem("openclaw.control.token.v1:default", token);
    }
  })();
</script>`;
        const autoConnectScript = `
<script>
  (function() {
    var token = (window.__OC_GATEWAY_TOKEN__ || "").trim();
    if (!token) return;
    var run = function() {
      try {
        var tokenInput =
          document.querySelector('input[placeholder*="OPENCLAW_GATEWAY_TOKEN"]') ||
          document.querySelector('input[name*="token" i]') ||
          document.querySelectorAll('input')[1];
        if (tokenInput && tokenInput.value !== token) {
          tokenInput.value = token;
          tokenInput.dispatchEvent(new Event("input", { bubbles: true }));
          tokenInput.dispatchEvent(new Event("change", { bubbles: true }));
        }

        var connectButton = Array.prototype.find.call(
          document.querySelectorAll("button"),
          function(btn) {
            var text = (btn.textContent || "").trim().toLowerCase();
            return text === "connect" || text === "verbinden";
          }
        );

        if (connectButton) {
          var statusText = (document.body && document.body.textContent ? document.body.textContent : "").toLowerCase();
          var isDisconnected = statusText.includes("disconnected") || statusText.includes("getrennt");
          if (isDisconnected) {
            connectButton.click();
          }
        }
      } catch (_err) {}
    };
    run();
    var id = window.setInterval(run, 1200);
    window.setTimeout(function() { window.clearInterval(id); }, 20000);
  })();
</script>`;
        const localeBridge = buildLocaleBridgeScript(locale, "openclaw");
        const injection = `<script>window.__OPENCLAW_CONTROL_UI_BASE_PATH__ = "/api/gateway";</script>${tokenScript}${autoConnectScript}${localeBridge}`;
        html = html.includes("<head>")
          ? html.replace("<head>", `<head>${injection}`)
          : `${injection}${html}`;
        return Buffer.from(html, "utf8");
      }

      return responseBuffer;
    }),
  },
});

const gatewayPassthroughProxy = createProxyMiddleware<express.Request, express.Response>({
  target: GATEWAY_URL,
  changeOrigin: false,
  pathRewrite: { "^/api/gateway": "" },
  ws: true,
  on: {
    proxyReq: (proxyReq, req) => {
      setLocaleHeaders(proxyReq, req);
    },
  },
});

app.use("/api/gateway", cookieParser(), async (req, res, next) => {
  if (req.method === "GET" && req.path === "/chat") {
    const incomingGatewayUrl = typeof req.query.gatewayUrl === "string" ? req.query.gatewayUrl.trim() : "";
    if (!incomingGatewayUrl) {
      const gatewayUrl = resolvePublicGatewayWsUrl(req);
      if (gatewayUrl) {
        const nextParams = new URLSearchParams(req.query as Record<string, string>);
        nextParams.set("gatewayUrl", gatewayUrl);
        const tokenHash = GATEWAY_TOKEN ? `#token=${encodeURIComponent(GATEWAY_TOKEN)}` : "";
        return res.redirect(302, `/api/gateway/chat?${nextParams.toString()}${tokenHash}`);
      }
    }

    const sessionEmail = getSessionEmail(req);
    if (sessionEmail) {
      await trackUsageEvent(sessionEmail, "terminal_open", { source: "gateway_chat_route" });
    }

    return gatewayChatProxy(req, res, next);
  }

  return gatewayPassthroughProxy(req, res, next);
});

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
  on: {
    proxyReq: (proxyReq, req) => {
      setLocaleHeaders(proxyReq, req);
    },
  },
});

app.use("/mc-api", mcBackendProxy);

const mcFrontendProxy = createProxyMiddleware<express.Request, express.Response>({
  target: MISSION_CONTROL_FRONTEND_URL,
  changeOrigin: true,
  ws: true,
  pathRewrite: (p) => (p === "/" ? "/mission-control" : `/mission-control${p}`),
  on: {
    proxyReq: (proxyReq, req) => {
      setLocaleHeaders(proxyReq, req);
    },
  },
});

app.use("/mission-control", mcFrontendProxy);

function rewritePaperclipHtml(html: string, locale: string): string {
  const swScopeGuard = `
<script>
  (function () {
    try {
      if (!("serviceWorker" in navigator)) return;
      const sw = navigator.serviceWorker;
      if (!sw || typeof sw.register !== "function") return;
      const origRegister = sw.register.bind(sw);
      sw.register = function (url, options) {
        try {
          let nextUrl = url;
          if (typeof nextUrl === "string") {
            if (nextUrl === "/sw.js") nextUrl = "/paperclip/sw.js";
            else if (nextUrl.startsWith("/") && !nextUrl.startsWith("/paperclip/")) {
              nextUrl = "/paperclip" + nextUrl;
            }
          }
          const nextOptions = { ...(options || {}) };
          if (!nextOptions.scope || nextOptions.scope === "/") {
            nextOptions.scope = "/paperclip/";
          }
          return origRegister(nextUrl, nextOptions);
        } catch (_err) {
          return origRegister(url, options);
        }
      };

      // Clean up accidentally registered root SW from previous broken embeds.
      sw.getRegistrations().then(function (regs) {
        regs.forEach(function (reg) {
          try {
            var scriptPath = new URL(reg.active ? reg.active.scriptURL : "").pathname;
            var isRootPaperclipSw = scriptPath === "/sw.js" && reg.scope === window.location.origin + "/";
            if (isRootPaperclipSw) reg.unregister();
          } catch (_err) {}
        });
      }).catch(function () {});
    } catch (_err) {}
  })();
</script>`;
  const localeBridge = buildLocaleBridgeScript(locale, "paperclip");

  return html
    .replace(/(["'])\/assets\//g, "$1/paperclip/assets/")
    .replace(/(["'])\/site\.webmanifest(["'])/g, "$1/paperclip/site.webmanifest$2")
    .replace(/(["'])\/sw\.js(["'])/g, "$1/paperclip/sw.js$2")
    .replace(/(["'])\/favicon([^"']*)(["'])/g, "$1/paperclip/favicon$2$3")
    .replace(/(["'])\/apple-touch-icon([^"']*)(["'])/g, "$1/paperclip/apple-touch-icon$2$3")
    .replace(/<head>/i, `<head>${swScopeGuard}${localeBridge}`);
}

function isPublicPaperclipAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/assets/") ||
    pathname === "/site.webmanifest" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/apple-touch-icon")
  );
}

function isPaperclipContextRequest(req: express.Request): boolean {
  const referer = typeof req.headers.referer === "string" ? req.headers.referer : "";
  if (referer.includes("/paperclip") || referer.includes("/paperclip-app")) {
    return true;
  }

  const nextParam = typeof req.query.next === "string" ? req.query.next : "";
  if (nextParam.includes("/paperclip")) {
    return true;
  }

  return req.query.paperclip === "1";
}

const paperclipProxy = createProxyMiddleware<express.Request, express.Response>({
  target: PAPERCLIP_URL,
  changeOrigin: true,
  ws: true,
  selfHandleResponse: true,
  pathRewrite: (incomingPath) => {
    const rewritten = incomingPath.replace(/^\/paperclip(?=\/|$)/, "") || "/";
    if (rewritten === "/health") return "/api/health";
    return rewritten;
  },
  on: {
    proxyReq: (proxyReq, req) => {
      setLocaleHeaders(proxyReq, req);
    },
    proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, expressRes) => {
      stripIframeHeaders(expressRes as express.Response);
      const contentType = (proxyRes.headers["content-type"] ?? "") as string;
      if (contentType.includes("text/html")) {
        return Buffer.from(rewritePaperclipHtml(responseBuffer.toString("utf8"), resolveEmbeddedLocale(req)), "utf8");
      }
      return responseBuffer;
    }),
  },
});

app.use("/paperclip", cookieParser(), (req, res, next) => {
  if ((req.method === "GET" || req.method === "HEAD") && isPublicPaperclipAssetPath(req.path)) {
    return next();
  }
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.headers["x-oc-user-email"] = sessionEmail;
  return next();
}, paperclipProxy);

const paperclipPassthroughProxy = createProxyMiddleware<express.Request, express.Response>({
  target: PAPERCLIP_URL,
  changeOrigin: true,
  ws: true,
  selfHandleResponse: true,
  pathRewrite: (incomingPath) => {
    const rewritten = incomingPath.replace(/^\/paperclip(?=\/|$)/, "") || "/";
    if (rewritten === "/health") return "/api/health";
    return rewritten;
  },
  on: {
    proxyReq: (proxyReq, req) => {
      setLocaleHeaders(proxyReq, req);
    },
    proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, expressRes) => {
      stripIframeHeaders(expressRes as express.Response);
      const contentType = (proxyRes.headers["content-type"] ?? "") as string;
      if (contentType.includes("text/html")) {
        return Buffer.from(rewritePaperclipHtml(responseBuffer.toString("utf8"), resolveEmbeddedLocale(req)), "utf8");
      }
      return responseBuffer;
    }),
  },
});

const paperclipDirectProxy = createProxyMiddleware<express.Request, express.Response>({
  target: PAPERCLIP_URL,
  changeOrigin: true,
  ws: true,
  selfHandleResponse: true,
  on: {
    proxyReq: (proxyReq, req) => {
      setLocaleHeaders(proxyReq, req);
    },
    proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, expressRes) => {
      stripIframeHeaders(expressRes as express.Response);
      const contentType = (proxyRes.headers["content-type"] ?? "") as string;
      if (contentType.includes("text/html")) {
        return Buffer.from(rewritePaperclipHtml(responseBuffer.toString("utf8"), resolveEmbeddedLocale(req)), "utf8");
      }
      return responseBuffer;
    }),
  },
});

// Paperclip UI performs some root-level calls (/api/auth/*, /api/companies, /auth)
// that must be routed to the Paperclip backend when embedded in our dashboard.
app.use("/api/auth", cookieParser(), (req, res, next) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }
  // Preserve the expected Paperclip auth prefix when mounted under /api/auth.
  req.url = `/api/auth${req.url}`;
  req.headers["x-oc-user-email"] = sessionEmail;
  return paperclipDirectProxy(req, res, next);
});

app.use("/api/companies", cookieParser(), (req, res, next) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }
  // Preserve companies API prefix for Paperclip backend routes.
  req.url = `/api/companies${req.url}`;
  req.headers["x-oc-user-email"] = sessionEmail;
  return paperclipDirectProxy(req, res, next);
});

app.use("/auth", cookieParser(), (req, res, next) => {
  if (!isPaperclipContextRequest(req)) return next();
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }
  // Preserve /auth prefix so BetterAuth handlers match correctly.
  req.url = `/auth${req.url}`;
  req.headers["x-oc-user-email"] = sessionEmail;
  return paperclipDirectProxy(req, res, next);
});

function isPaperclipFallbackPath(pathname: string): boolean {
  const first = pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
  if (!first) return false;
  if (first.startsWith("api")) return false;

  const reserved = new Set([
    "health",
    "mission-control",
    "mission-control-app",
    "mc-api",
    "paperclip",
    "paperclip-app",
    "openclaw",
    "dashboard",
    "nemoclaw-app",
    "pricing",
    "setup",
    "signup",
    "sign-in",
    "blog",
    "usage",
    "subscription",
    "assets",
    "sw.js",
    "site.webmanifest",
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
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return next();
  }
  req.headers["x-oc-user-email"] = sessionEmail;
  return paperclipPassthroughProxy(req, res, next);
});

// Paperclip frontend probes /api/health; bridge this path to Paperclip backend
// so it works even when browsers omit Referer in embedded/private contexts.
app.get("/api/health", (req, res, next) => {
  return paperclipPassthroughProxy(req, res, next);
});

function stripIframeHeaders(res: express.Response) {
  res.removeHeader("x-frame-options");
  const csp = res.getHeader("content-security-policy");
  if (typeof csp === "string") {
    const relaxed = csp
      .replace(/frame-ancestors[^;]*(;|$)/g, "")
      .replace(/frame-src[^;]*(;|$)/g, "");
    let normalized = relaxed;
    const scriptAllowsInline = /script-src[^;]*unsafe-inline/i.test(normalized);
    if (/script-src/i.test(normalized) && !scriptAllowsInline) {
      normalized = normalized.replace(
        /script-src\s+([^;]*)/i,
        (_full, sources: string) => `script-src ${sources} 'unsafe-inline' 'unsafe-eval'`,
      );
    }
    res.setHeader("content-security-policy", normalized);
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
            const localeBridge = buildLocaleBridgeScript(resolveEmbeddedLocale(req), "openclaw");
            const injection = `<script>window.__OPENCLAW_CONTROL_UI_BASE_PATH__ = "/api/instance-proxy";</script>${localeBridge}`;
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
            const localeBridge = buildLocaleBridgeScript(resolveEmbeddedLocale(req), "openclaw");
            const injection = `<script>window.__OPENCLAW_CONTROL_UI_BASE_PATH__ = "/api/instance-proxy";</script>${localeBridge}`;
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

  app.get(["/sitemap.xml", "/robots.txt"], (req, res, next) => {
    const filePath = path.join(frontendDist, req.path.replace(/^\//, ""));
    if (existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    return next();
  });

  app.use((req, res, next) => {
      const isSpaRoute =
        (req.method === "GET" || req.method === "HEAD") &&
        path.extname(req.path) === "" &&
        !req.path.startsWith("/api/") &&
        !req.path.startsWith("/health") &&
        !req.path.startsWith("/mission-control") &&
        !req.path.startsWith("/mc-api") &&
        !/^\/paperclip(?:\/|$)/.test(req.path);

    if (isSpaRoute) {
      return res.sendFile(path.join(frontendDist, "index.html"));
    }
    next();
  });
}

export default app;
