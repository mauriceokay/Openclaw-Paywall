import en from "./locales/en";
import de from "./locales/de";
import fr from "./locales/fr";
import zhCN from "./locales/zh-CN";
import zhTW from "./locales/zh-TW";
import ja from "./locales/ja";
import ar from "./locales/ar";
import pl from "./locales/pl";
import ko from "./locales/ko";
import ms from "./locales/ms";
import it from "./locales/it";

export const translations = {
  en,
  de,
  fr,
  it,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  ja,
  ar,
  pl,
  ko,
  ms,
} as const;

export type LocaleCode = keyof typeof translations;
export type Locale = typeof en;

export const SUPPORTED_LANGUAGES: { code: LocaleCode; label: string; flag: string; dir?: "rtl" }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "zh-CN", label: "中文（简体）", flag: "🇨🇳" },
  { code: "zh-TW", label: "中文（繁體）", flag: "🇹🇼" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "ms", label: "Bahasa Melayu", flag: "🇸🇬" },
  { code: "ar", label: "العربية", flag: "🇸🇦", dir: "rtl" },
  { code: "pl", label: "Polski", flag: "🇵🇱" },
];

const LS_KEY = "openclaw-language";

export function detectLocale(): LocaleCode {
  try {
    const stored = localStorage.getItem(LS_KEY) as LocaleCode | null;
    if (stored && stored in translations) return stored;
  } catch {}

  const lang = navigator.language || "en";
  if (lang.startsWith("zh-TW") || lang.startsWith("zh-HK") || lang.startsWith("zh-MO")) return "zh-TW";
  if (lang.startsWith("zh")) return "zh-CN";
  if (lang.startsWith("ja")) return "ja";
  if (lang.startsWith("ko")) return "ko";
  if (lang.startsWith("it")) return "it";
  if (lang.startsWith("ms")) return "ms";
  if (lang.startsWith("de")) return "de";
  if (lang.startsWith("fr")) return "fr";
  if (lang.startsWith("ar")) return "ar";
  if (lang.startsWith("pl")) return "pl";
  return "en";
}

export function saveLocale(code: LocaleCode) {
  try {
    localStorage.setItem(LS_KEY, code);
  } catch {}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeWithFallback<T>(base: T, override: unknown): T {
  if (Array.isArray(base)) {
    return (Array.isArray(override) ? override : base) as T;
  }
  if (isPlainObject(base)) {
    const out: Record<string, unknown> = { ...base };
    const src = isPlainObject(override) ? override : {};
    for (const key of Object.keys(base as Record<string, unknown>)) {
      out[key] = mergeWithFallback(
        (base as Record<string, unknown>)[key],
        src[key],
      );
    }
    return out as T;
  }
  return (override ?? base) as T;
}

export function getTranslations(code: LocaleCode): Locale {
  return mergeWithFallback(en, translations[code]);
}

export function isRTL(code: LocaleCode) {
  return code === "ar";
}
