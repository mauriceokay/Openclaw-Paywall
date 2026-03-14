import { Helmet } from "react-helmet-async";
import type { LocaleCode } from "@/i18n";

const SITE_URL = "https://openclaw.cloud";
const OG_IMAGE = `${SITE_URL}/opengraph.jpg`;
const SITE_NAME = "OpenClaw Cloud";

const OG_LOCALE: Record<LocaleCode, string> = {
  en:    "en_US",
  de:    "de_DE",
  fr:    "fr_FR",
  "zh-CN": "zh_CN",
  "zh-TW": "zh_TW",
  ja:    "ja_JP",
  ko:    "ko_KR",
  ms:    "ms_SG",
  ar:    "ar_SA",
  pl:    "pl_PL",
};

const HREFLANG: Record<LocaleCode, string> = {
  en:    "en",
  de:    "de",
  fr:    "fr",
  "zh-CN": "zh-Hans",
  "zh-TW": "zh-Hant",
  ja:    "ja",
  ko:    "ko",
  ms:    "ms",
  ar:    "ar",
  pl:    "pl",
};

const ALL_LOCALES: LocaleCode[] = ["en", "de", "fr", "zh-CN", "zh-TW", "ja", "ko", "ms", "ar", "pl"];

interface SEOHeadProps {
  title: string;
  description: string;
  canonicalPath?: string;
  locale: LocaleCode;
  type?: "website" | "article";
  noindex?: boolean;
  keywords?: string;
  publishedAt?: string;
}

export function SEOHead({
  title,
  description,
  canonicalPath = "/",
  locale,
  type = "website",
  noindex = false,
  keywords,
  publishedAt,
}: SEOHeadProps) {
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />
      <link rel="canonical" href={canonicalUrl} />

      {/* hreflang — all locales served from same URL */}
      {ALL_LOCALES.map((code) => (
        <link
          key={code}
          rel="alternate"
          hrefLang={HREFLANG[code]}
          href={canonicalUrl}
        />
      ))}
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content={OG_LOCALE[locale]} />
      {ALL_LOCALES.filter((c) => c !== locale).map((code) => (
        <meta key={code} property="og:locale:alternate" content={OG_LOCALE[code]} />
      ))}
      {type === "article" && publishedAt && (
        <meta property="article:published_time" content={publishedAt} />
      )}

      {/* Twitter / X */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@openclaw_ai" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={OG_IMAGE} />
    </Helmet>
  );
}
