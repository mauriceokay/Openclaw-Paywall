import { type Response, Router } from "express";
import crypto from "crypto";
import { existsSync, readFileSync } from "fs";
import { getSessionEmail } from "../sessionAuth";
import { trackUsageEvent } from "../usageTracking";

const router = Router();
const PAPERCLIP_URL = process.env.PAPERCLIP_URL ?? "http://127.0.0.1:3100";
const PAPERCLIP_SSO_SECRET =
  process.env.PAPERCLIP_SSO_SECRET?.trim() || process.env.SESSION_SECRET?.trim() || "openclaw-paperclip-sso";
const APP_URL = process.env.APP_URL?.trim() || "http://localhost:8080";
const PAPERCLIP_BOOTSTRAP_INVITE_FILE =
  process.env.PAPERCLIP_BOOTSTRAP_INVITE_FILE ?? "/paperclip-data/bootstrap_invite_url.txt";
const PAPERCLIP_BOOTSTRAP_INVITE_URL = process.env.PAPERCLIP_BOOTSTRAP_INVITE_URL?.trim() || null;

function toAppRelativePaperclipUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return path.startsWith("/") ? path : `/${path}`;
  } catch {
    return null;
  }
}

async function resolvePaperclipLaunchUrl(): Promise<string> {
  try {
    const response = await fetch(`${PAPERCLIP_URL}/api/health`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return "/paperclip?paperclip=1";

    const payload = (await response.json()) as {
      bootstrapStatus?: string;
      bootstrapInviteActive?: boolean;
    };

    if (payload.bootstrapStatus === "bootstrap_pending" && payload.bootstrapInviteActive) {
      const envRelative = PAPERCLIP_BOOTSTRAP_INVITE_URL
        ? toAppRelativePaperclipUrl(PAPERCLIP_BOOTSTRAP_INVITE_URL)
        : null;
      if (envRelative) return envRelative;

      if (existsSync(PAPERCLIP_BOOTSTRAP_INVITE_FILE)) {
        const inviteUrl = readFileSync(PAPERCLIP_BOOTSTRAP_INVITE_FILE, "utf8").trim();
        const relative = toAppRelativePaperclipUrl(inviteUrl);
        if (relative) return relative;
      }
    }
  } catch {
    // fall back to standard launch path
  }

  return "/paperclip?paperclip=1";
}

function derivePaperclipPassword(email: string): string {
  const digest = crypto
    .createHmac("sha256", PAPERCLIP_SSO_SECRET)
    .update(email.trim().toLowerCase())
    .digest("hex");

  // Meets strong password requirements while staying deterministic per user.
  return `${digest.slice(0, 20)}Aa!9${digest.slice(20, 40)}`;
}

function deriveDisplayName(email: string): string {
  const localPart = email.split("@")[0] ?? "User";
  const normalized = localPart.replace(/[._-]+/g, " ").trim();
  if (!normalized) return "User";
  return normalized
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getResponseCookies(response: Response): string[] {
  const withGetSetCookie = response.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof withGetSetCookie.getSetCookie === "function") {
    return withGetSetCookie.getSetCookie();
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

function appendSetCookies(res: Response, cookies: string[]): void {
  if (!cookies.length) return;

  const current = res.getHeader("set-cookie");
  const existing = Array.isArray(current) ? current.map(String) : current ? [String(current)] : [];
  // Keep cookies host-only and preserve all other attributes from Paperclip.
  const normalized = cookies.map((cookie) => cookie.replace(/;\s*Domain=[^;]+/i, ""));
  res.setHeader("set-cookie", [...existing, ...normalized]);
}

async function paperclipAuthRequest(
  path: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  const appOrigin = (() => {
    try {
      return new URL(APP_URL).origin;
    } catch {
      return "http://localhost:8080";
    }
  })();
  const appHost = (() => {
    try {
      return new URL(appOrigin).host;
    } catch {
      return "localhost:8080";
    }
  })();
  const appProtocol = appOrigin.startsWith("https://") ? "https" : "http";

  const publicPaperclipBase = `${APP_URL.replace(/\/+$/, "")}/paperclip`;

  return fetch(`${publicPaperclipBase}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      origin: appOrigin,
      referer: `${appOrigin}/paperclip`,
      "x-forwarded-host": appHost,
      "x-forwarded-proto": appProtocol,
    },
    body: JSON.stringify(payload),
    redirect: "manual",
  });
}

async function ensurePaperclipSession(sessionEmail: string, res: Response): Promise<void> {
  const email = sessionEmail.trim().toLowerCase();
  const password = derivePaperclipPassword(email);

  const signInPayload = {
    email,
    password,
    rememberMe: true,
  };

  let signInResponse = await paperclipAuthRequest("/api/auth/sign-in/email", signInPayload);

  if (!signInResponse.ok) {
    let signInError = "";
    try {
      signInError = await signInResponse.text();
    } catch {
      signInError = "";
    }
    console.warn("[paperclip-sso] sign-in failed", signInResponse.status, signInError.slice(0, 400));

    // First-time user flow: create account, then sign in.
    const signUpResponse = await paperclipAuthRequest("/api/auth/sign-up/email", {
      email,
      password,
      name: deriveDisplayName(email),
    });
    if (!signUpResponse.ok) {
      let signUpError = "";
      try {
        signUpError = await signUpResponse.text();
      } catch {
        signUpError = "";
      }
      console.warn("[paperclip-sso] sign-up failed", signUpResponse.status, signUpError.slice(0, 400));
    }

    signInResponse = await paperclipAuthRequest("/api/auth/sign-in/email", signInPayload);
    if (!signInResponse.ok) {
      let secondSignInError = "";
      try {
        secondSignInError = await signInResponse.text();
      } catch {
        secondSignInError = "";
      }
      console.warn(
        "[paperclip-sso] second sign-in failed",
        signInResponse.status,
        secondSignInError.slice(0, 400),
      );
    }
  }

  appendSetCookies(res, getResponseCookies(signInResponse));
}

router.get("/paperclip/launch", async (req, res) => {
  const sessionEmail = getSessionEmail(req);
  if (!sessionEmail) {
    return res.status(401).json({ error: "Authentication required" });
  }

  await trackUsageEvent(sessionEmail, "paperclip_open", {
    source: "dashboard",
  });

  try {
    await ensurePaperclipSession(sessionEmail, res);
  } catch {
    // Keep launch resilient: if Paperclip auth bridge fails transiently, the UI can still load.
  }

  const launchUrl = await resolvePaperclipLaunchUrl();

  return res.json({
    launchUrl,
  });
});

export default router;
