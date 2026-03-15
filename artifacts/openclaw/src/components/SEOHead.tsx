import { Helmet } from "react-helmet-async";
import type { LocaleCode } from "@/i18n";

const SITE_URL = "https://openclaw.cloud";
const OG_IMAGE = `${SITE_URL}/opengraph.jpg`;
const OG_IMAGE_ALT = "OpenClaw Cloud — Self-Hosted Personal AI Assistant";
const SITE_NAME = "OpenClaw Cloud";
const TWITTER_HANDLE = "@openclaw_ai";

const OG_LOCALE: Record<LocaleCode, string> = {
  en:      "en_US",
  de:      "de_DE",
  fr:      "fr_FR",
  "zh-CN": "zh_CN",
  "zh-TW": "zh_TW",
  ja:      "ja_JP",
  ko:      "ko_KR",
  ms:      "ms_SG",
  ar:      "ar_SA",
  pl:      "pl_PL",
};

const HREFLANG: Record<LocaleCode, string> = {
  en:      "en",
  de:      "de",
  fr:      "fr",
  "zh-CN": "zh-Hans",
  "zh-TW": "zh-Hant",
  ja:      "ja",
  ko:      "ko",
  ms:      "ms",
  ar:      "ar",
  pl:      "pl",
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
  /** ISO date string — when the article was first published */
  publishedAt?: string;
  /** ISO date string — when the article was last modified (falls back to publishedAt) */
  modifiedAt?: string;
  /** Article section / category (e.g. "Guides") */
  articleSection?: string;
  /** Article tags for article:tag OG property */
  articleTags?: string[];
  /** Per-post OG image URL (defaults to global OG_IMAGE) */
  ogImage?: string;
  /** Alt text for the OG image */
  ogImageAlt?: string;
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
  modifiedAt,
  articleSection,
  articleTags,
  ogImage,
  ogImageAlt,
}: SEOHeadProps) {
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const image = ogImage ?? OG_IMAGE;
  const imageAlt = ogImageAlt ?? OG_IMAGE_ALT;
  const effectiveModified = modifiedAt ?? publishedAt;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"} />
      <meta name="author" content={SITE_NAME} />
      <meta name="application-name" content={SITE_NAME} />
      <link rel="canonical" href={canonicalUrl} />

      {/* hreflang — all locales served from same URL (SPA language switch) */}
      {ALL_LOCALES.map((code) => (
        <link key={code} rel="alternate" hrefLang={HREFLANG[code]} href={canonicalUrl} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />

      {/* Open Graph — base */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:image" content={image} />
      <meta property="og:image:secure_url" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:type" content="image/jpeg" />
      <meta property="og:image:alt" content={imageAlt} />
      <meta property="og:locale" content={OG_LOCALE[locale]} />
      {ALL_LOCALES.filter((c) => c !== locale).map((code) => (
        <meta key={code} property="og:locale:alternate" content={OG_LOCALE[code]} />
      ))}

      {/* Open Graph — article-specific */}
      {type === "article" && publishedAt && (
        <meta property="article:published_time" content={publishedAt} />
      )}
      {type === "article" && effectiveModified && (
        <meta property="article:modified_time" content={effectiveModified} />
      )}
      {type === "article" && (
        <meta property="article:author" content={SITE_URL} />
      )}
      {type === "article" && articleSection && (
        <meta property="article:section" content={articleSection} />
      )}
      {type === "article" && articleTags?.map((tag) => (
        <meta key={tag} property="article:tag" content={tag} />
      ))}

      {/* Twitter / X */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_HANDLE} />
      <meta name="twitter:creator" content={TWITTER_HANDLE} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={imageAlt} />
    </Helmet>
  );
}
