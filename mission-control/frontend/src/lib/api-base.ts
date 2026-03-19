export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw && raw.toLowerCase() !== "auto") {
    const normalized = raw.replace(/\/+$/, "");
    if (!normalized) {
      throw new Error("NEXT_PUBLIC_API_URL is invalid.");
    }
    return normalized;
  }

  if (typeof window !== "undefined") {
    // In the integrated OpenClaw setup, API traffic should go through the
    // same-origin reverse proxy mounted at /mc-api.
    return `${window.location.origin}/mc-api`;
  }

  throw new Error(
    "NEXT_PUBLIC_API_URL is not set and cannot be auto-resolved outside the browser.",
  );
}
