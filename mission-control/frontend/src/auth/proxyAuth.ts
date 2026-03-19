"use client";

import { AuthMode } from "@/auth/mode";

const OC_USER_KEY = "oc_user";

interface OcUser {
  name: string;
  email: string;
}

export function isProxyAuthMode(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_MODE === AuthMode.Proxy;
}

export function getProxyUser(): OcUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(OC_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && "email" in parsed) {
      const email = typeof (parsed as OcUser).email === "string" ? (parsed as OcUser).email.trim() : "";
      const nameRaw = "name" in parsed && typeof (parsed as OcUser).name === "string"
        ? (parsed as OcUser).name.trim()
        : "";
      if (!email) return null;
      return {
        email,
        name: nameRaw || email,
      };
    }
  } catch {
    // ignore
  }
  return null;
}
