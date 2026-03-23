import { type Response as ExpressResponse, Router } from "express";
import crypto from "crypto";
import { existsSync, readFileSync } from "fs";
import { createPool } from "@workspace/db";
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
const PAPERCLIP_AUTH_SECRET =
  process.env.PAPERCLIP_AUTH_SECRET?.trim() ||
  process.env.PAPERCLIP_AGENT_JWT_SECRET?.trim() ||
  process.env.BETTER_AUTH_SECRET?.trim() ||
  null;

type PaperclipPool = ReturnType<typeof createPool>;
let paperclipDbPool: PaperclipPool | null = null;

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

function getResponseCookies(response: globalThis.Response): string[] {
  const withGetSetCookie = response.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof withGetSetCookie.getSetCookie === "function") {
    return withGetSetCookie.getSetCookie();
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

function appendSetCookies(res: ExpressResponse, cookies: string[]): void {
  if (!cookies.length) return;

  const current = res.getHeader("set-cookie");
  const existing = Array.isArray(current) ? current.map(String) : current ? [String(current)] : [];
  // Keep cookies host-only and preserve all other attributes from Paperclip.
  const normalized = cookies.map((cookie) => cookie.replace(/;\s*Domain=[^;]+/i, ""));
  res.setHeader("set-cookie", [...existing, ...normalized]);
}

function resolvePaperclipDatabaseUrl(): string | null {
  const explicit = process.env.PAPERCLIP_DATABASE_URL?.trim();
  if (explicit) return explicit;

  const base = process.env.DATABASE_URL?.trim();
  if (!base) return null;

  try {
    const parsed = new URL(base);
    parsed.pathname = "/paperclip";
    return parsed.toString();
  } catch {
    return null;
  }
}

function getPaperclipDbPool(): PaperclipPool | null {
  if (paperclipDbPool) return paperclipDbPool;
  const connectionString = resolvePaperclipDatabaseUrl();
  if (!connectionString) return null;
  paperclipDbPool = createPool(connectionString);
  return paperclipDbPool;
}

function signBetterAuthCookieValue(value: string, secret: string): string {
  const signature = crypto.createHmac("sha256", secret).update(value).digest("base64");
  return encodeURIComponent(`${value}.${signature}`);
}

async function upsertPaperclipSession(email: string, res: ExpressResponse): Promise<boolean> {
  const pool = getPaperclipDbPool();
  if (!pool || !PAPERCLIP_AUTH_SECRET) return false;

  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingUser = await client.query<{ id: string }>(
      'SELECT id FROM "user" WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [normalizedEmail],
    );

    const userId = existingUser.rows[0]?.id ?? `pcp_${crypto.randomUUID().replace(/-/g, "")}`;
    if (!existingUser.rows[0]) {
      await client.query(
        `INSERT INTO "user" (id, name, email, email_verified, image, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, deriveDisplayName(normalizedEmail), normalizedEmail, true, null, now, now],
      );
    } else {
      await client.query('UPDATE "user" SET updated_at = $2 WHERE id = $1', [userId, now]);
    }

    const sessionToken = crypto.randomBytes(32).toString("hex");
    const sessionId = `sess_${crypto.randomUUID().replace(/-/g, "")}`;
    await client.query(
      `INSERT INTO "session" (id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [sessionId, expiresAt, sessionToken, now, now, null, "openclaw-paperclip-bridge", userId],
    );

    await client.query("COMMIT");

    const signedToken = signBetterAuthCookieValue(sessionToken, PAPERCLIP_AUTH_SECRET);
    const secure = APP_URL.startsWith("https://");
    const cookie = [
      `better-auth.session_token=${signedToken}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=2592000",
      secure ? "Secure" : null,
    ]
      .filter(Boolean)
      .join("; ");

    appendSetCookies(res, [cookie]);
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return false;
  } finally {
    client.release();
  }
}

async function paperclipAuthRequest(
  path: string,
  payload: Record<string, unknown>,
): Promise<globalThis.Response> {
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

  return fetch(`${PAPERCLIP_URL}${path}`, {
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

async function ensurePaperclipSession(sessionEmail: string, res: ExpressResponse): Promise<void> {
  const email = sessionEmail.trim().toLowerCase();
  const password = derivePaperclipPassword(email);

  const signInPayload = {
    email,
    password,
    rememberMe: true,
  };

  const signInCandidates = ["/api/auth/sign-in/email", "/api/auth/sign-in"];
  const signUpCandidates = ["/api/auth/sign-up/email", "/api/auth/sign-up"];

  const tryCandidates = async (
    candidates: string[],
    payload: Record<string, unknown>,
  ): Promise<globalThis.Response> => {
    let lastResponse: globalThis.Response | null = null;
    for (const candidate of candidates) {
      const response = await paperclipAuthRequest(candidate, payload);
      lastResponse = response;
      if (response.status !== 404) {
        return response;
      }
    }
    return lastResponse ?? (await paperclipAuthRequest(candidates[0], payload));
  };

  let signInResponse = await tryCandidates(signInCandidates, signInPayload);

  if (!signInResponse.ok) {
    let signInError = "";
    try {
      signInError = await signInResponse.text();
    } catch {
      signInError = "";
    }
    console.warn("[paperclip-sso] sign-in failed", signInResponse.status, signInError.slice(0, 400));

    // First-time user flow: create account, then sign in.
    const signUpResponse = await tryCandidates(signUpCandidates, {
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

    signInResponse = await tryCandidates(signInCandidates, signInPayload);
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

      // Fallback for Paperclip builds where HTTP sign-in routes are unavailable:
      // create a signed BetterAuth session directly in the Paperclip DB.
      if (await upsertPaperclipSession(email, res)) {
        return;
      }
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
