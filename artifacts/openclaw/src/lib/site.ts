const DEFAULT_SITE_URL = "https://getlobster.org";

function normalizeSiteUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export const SITE_URL = normalizeSiteUrl(
  import.meta.env.VITE_SITE_URL ?? DEFAULT_SITE_URL,
);

export const OG_IMAGE = `${SITE_URL}/opengraph.jpg`;
