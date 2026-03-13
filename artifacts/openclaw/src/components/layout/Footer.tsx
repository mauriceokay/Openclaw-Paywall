import { Link } from "wouter";
import { useLanguage } from "@/context/LanguageContext";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-white/5 bg-card/30 mt-24">
      <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🦞</span>
          <span className="font-display font-bold text-xl text-gradient opacity-80">OpenClaw</span>
        </div>

        <p className="text-muted-foreground text-sm text-center md:text-left">
          {t.footer.tagline}
        </p>

        <div className="flex items-center gap-6">
          <Link href="/blog" className="text-sm text-muted-foreground hover:text-primary transition-colors">{t.footer.blog}</Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">{t.footer.terms}</Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">{t.footer.privacy}</Link>
          <a href="https://github.com/openclaw/openclaw" target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-primary transition-colors">GitHub</a>
        </div>
      </div>
    </footer>
  );
}
