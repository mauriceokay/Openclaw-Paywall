import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

const SESSION_COOKIE = "__oc_session";
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required but was not provided.");
}
const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;

function sign(payload: string): string {
  const hmac = crypto.createHmac("sha256", SESSION_SECRET);
  hmac.update(payload);
  return hmac.digest("hex");
}

function createSessionToken(email: string): string {
  const expiresAt = Date.now() + SESSION_MAX_AGE;
  const payload = `${email}|${expiresAt}`;
  const signature = sign(payload);
  return `${payload}|${signature}`;
}

export function verifySessionToken(token: string): string | null {
  const parts = token.split("|");
  if (parts.length !== 3) return null;

  const [email, expiresAtStr, providedSig] = parts;
  const payload = `${email}|${expiresAtStr}`;
  const expectedSig = sign(payload);

  if (!crypto.timingSafeEqual(Buffer.from(providedSig, "hex"), Buffer.from(expectedSig, "hex"))) {
    return null;
  }

  const expiresAt = parseInt(expiresAtStr, 10);
  if (Date.now() > expiresAt) return null;

  return email;
}

export function setSessionCookie(res: Response, email: string): void {
  const token = createSessionToken(email);
  const isHttpsLike =
    process.env.NODE_ENV === "production" &&
    process.env.APP_URL?.startsWith("https://");
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: Boolean(isHttpsLike),
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export function getSessionEmail(req: Request): string | null {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  return verifySessionToken(token);
}

export function requireSession(req: Request, res: Response, next: NextFunction): void {
  const email = getSessionEmail(req);
  if (!email) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  (req as any).sessionEmail = email;
  next();
}
