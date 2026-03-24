import crypto from "crypto";
import type { Request } from "express";

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type JwtPayload = {
  iss?: string;
  sub?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  email?: string;
  email_address?: string;
  primary_email_address?: string;
  [key: string]: unknown;
};

type ClerkUserResponse = {
  primary_email_address_id?: string;
  email_addresses?: Array<{ id?: string; email_address?: string }>;
};

type JwkKey = Record<string, unknown> & {
  kid?: string;
};

type CachedJwks = {
  expiresAt: number;
  keys: JwkKey[];
};

const CLOCK_SKEW_SECONDS = 60;
const JWKS_TTL_MS = 10 * 60 * 1000;
const JWKS_CACHE = new Map<string, CachedJwks>();

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;
  return normalized;
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.get("authorization") || req.get("Authorization");
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function base64UrlJsonDecode<T>(encoded: string): T | null {
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function parseJwt(token: string): { header: JwtHeader; payload: JwtPayload; signingInput: string; signature: Buffer } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = base64UrlJsonDecode<JwtHeader>(encodedHeader);
  const payload = base64UrlJsonDecode<JwtPayload>(encodedPayload);
  if (!header || !payload) return null;
  return {
    header,
    payload,
    signingInput: `${encodedHeader}.${encodedPayload}`,
    signature: Buffer.from(encodedSignature, "base64url"),
  };
}

function payloadHasValidTimeWindow(payload: JwtPayload): boolean {
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.nbf === "number" && now + CLOCK_SKEW_SECONDS < payload.nbf) return false;
  if (typeof payload.exp === "number" && now - CLOCK_SKEW_SECONDS > payload.exp) return false;
  return true;
}

function resolveJwksUrl(issuer: string): string | null {
  try {
    const url = new URL(issuer);
    if (url.protocol !== "https:") return null;
    return new URL("/.well-known/jwks.json", url).toString();
  } catch {
    return null;
  }
}

async function fetchJwks(issuer: string): Promise<JwkKey[] | null> {
  const now = Date.now();
  const cached = JWKS_CACHE.get(issuer);
  if (cached && cached.expiresAt > now) return cached.keys;

  const jwksUrl = resolveJwksUrl(issuer);
  if (!jwksUrl) return null;

  try {
    const response = await fetch(jwksUrl, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = await response.json() as { keys?: JwkKey[] };
    const keys = Array.isArray(data.keys) ? data.keys : [];
    JWKS_CACHE.set(issuer, { keys, expiresAt: now + JWKS_TTL_MS });
    return keys;
  } catch {
    return null;
  }
}

function verifyWithKey(signingInput: string, signature: Buffer, key: JwkKey): boolean {
  try {
    const publicKey = crypto.createPublicKey({ key: key as any, format: "jwk" });
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(signingInput);
    verifier.end();
    return verifier.verify(publicKey, signature);
  } catch {
    return false;
  }
}

async function verifyJwtAndGetPayload(token: string): Promise<JwtPayload | null> {
  const parsed = parseJwt(token);
  if (!parsed) return null;

  const { header, payload, signingInput, signature } = parsed;
  if (header.alg !== "RS256") return null;
  if (!payload.iss || !payloadHasValidTimeWindow(payload)) return null;

  const keys = await fetchJwks(payload.iss);
  if (!keys || keys.length === 0) return null;

  const candidateKeys = header.kid
    ? keys.filter((k) => typeof k.kid === "string" && k.kid === header.kid)
    : keys;
  if (candidateKeys.length === 0) return null;

  const verified = candidateKeys.some((key) => verifyWithKey(signingInput, signature, key));
  if (!verified) return null;

  return payload;
}

function extractEmailFromPayload(payload: JwtPayload): string | null {
  const direct =
    normalizeEmail(payload.email)
    || normalizeEmail(payload.email_address)
    || normalizeEmail(payload.primary_email_address);
  if (direct) return direct;

  const nestedEmail = normalizeEmail((payload as any)?.user?.email) || normalizeEmail((payload as any)?.claims?.email);
  if (nestedEmail) return nestedEmail;

  const emailCandidates = (payload as any)?.email_addresses;
  if (Array.isArray(emailCandidates)) {
    for (const candidate of emailCandidates) {
      const value = normalizeEmail(candidate?.email_address) || normalizeEmail(candidate);
      if (value) return value;
    }
  }

  return null;
}

async function fetchEmailFromClerkUserApi(userId: string): Promise<string | null> {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) return null;

  const base = (process.env.CLERK_API_URL?.trim() || "https://api.clerk.com").replace(/\/+$/, "");
  const url = `${base}/v1/users/${encodeURIComponent(userId)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        accept: "application/json",
      },
    });
    if (!response.ok) return null;
    const user = await response.json() as ClerkUserResponse;
    const primaryId = user.primary_email_address_id;
    const addresses = Array.isArray(user.email_addresses) ? user.email_addresses : [];
    const primary = addresses.find((entry) => entry.id && entry.id === primaryId) ?? addresses[0];
    return normalizeEmail(primary?.email_address);
  } catch {
    return null;
  }
}

export async function getVerifiedClerkEmail(req: Request): Promise<string | null> {
  const token = getBearerToken(req) || req.cookies?.__session;
  if (!token) return null;

  const payload = await verifyJwtAndGetPayload(token);
  if (!payload) return null;

  const fromClaims = extractEmailFromPayload(payload);
  if (fromClaims) return fromClaims;

  const userId = typeof payload.sub === "string" ? payload.sub.trim() : "";
  if (!userId) return null;

  return await fetchEmailFromClerkUserApi(userId);
}
