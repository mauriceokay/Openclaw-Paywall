import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { SUPPORTED_LANGUAGES } from "@/i18n";

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [openLeft, setOpenLeft] = useState(false);

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === locale) ?? SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleToggle() {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setOpenLeft(rect.left < 200);
    }
    setOpen((v) => !v);
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={handleToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "8px",
          color: "#fff",
          padding: "6px 12px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: 500,
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.14)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
        aria-label="Select language"
      >
        <span>{current.flag}</span>
        <span style={{ maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {current.label}
        </span>
        <span style={{ fontSize: "10px", opacity: 0.6, marginLeft: "2px" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            ...(openLeft ? { left: 0 } : { right: 0 }),
            background: "#1a1a2e",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "12px",
            minWidth: "180px",
            maxWidth: "calc(100vw - 24px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => { setLocale(lang.code); setOpen(false); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                background: lang.code === locale ? "rgba(255,80,50,0.18)" : "transparent",
                border: "none",
                color: lang.code === locale ? "#FF5032" : "#ccc",
                padding: "10px 16px",
                cursor: "pointer",
                fontSize: "14px",
                textAlign: "left",
                fontWeight: lang.code === locale ? 600 : 400,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                if (lang.code !== locale) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                if (lang.code !== locale) e.currentTarget.style.background = "transparent";
              }}
            >
              <span style={{ fontSize: "18px" }}>{lang.flag}</span>
              <span>{lang.label}</span>
              {lang.code === locale && <span style={{ marginLeft: "auto", fontSize: "12px" }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
