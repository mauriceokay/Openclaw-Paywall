import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { detectLocale, saveLocale, getTranslations, isRTL, type LocaleCode, type Locale } from "@/i18n";

interface LanguageContextValue {
  locale: LocaleCode;
  t: Locale;
  setLocale: (code: LocaleCode) => void;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(() => detectLocale());

  const setLocale = (code: LocaleCode) => {
    saveLocale(code);
    setLocaleState(code);
  };

  const dir = isRTL(locale) ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const value: LanguageContextValue = {
    locale,
    t: getTranslations(locale),
    setLocale,
    dir,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
