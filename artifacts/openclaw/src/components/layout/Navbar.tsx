import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, User, MoreVertical, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useQuery } from "@tanstack/react-query";

export function Navbar() {
  const [location] = useLocation();
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const { data: subscriptionStatus } = useQuery<{ hasActiveSubscription?: boolean; planName?: string | null }>({
    queryKey: ["navbar-subscription-status", user?.email],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (user?.email) params.set("email", user.email);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${BASE_URL}/api/subscription/status${suffix}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch subscription status");
      return (await res.json()) as { hasActiveSubscription?: boolean; planName?: string | null };
    },
    enabled: Boolean(user?.email),
    retry: false,
  });

  const hasActivePlan = Boolean(
    subscriptionStatus?.hasActiveSubscription ||
    (subscriptionStatus?.planName && subscriptionStatus.planName.trim().length > 0)
  );

  const navLinks = [
    { label: t.nav.home, href: "/" },
    { label: t.nav.blog, href: "/blog" },
    { label: t.nav.dashboard, href: "/dashboard" },
  ];
  if (!hasActivePlan) {
    navLinks.splice(2, 0, { label: t.nav.pricing, href: "/pricing" });
  }

  return (
    <header className="relative md:fixed md:top-0 md:inset-x-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group" onClick={() => setMobileOpen(false)}>
          <motion.div whileHover={{ rotate: 20, scale: 1.1 }} className="text-3xl">
            🦞
          </motion.div>
          <span className="font-display font-bold text-xl md:text-2xl tracking-tight text-gradient">
            OpenClaw
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                location === link.href ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          {user ? (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center">
                  <User className="w-3 h-3 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground/80 max-w-[120px] truncate">
                  {user.name}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="text-muted-foreground hover:text-foreground gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                {t.nav.signOut}
              </Button>
            </>
          ) : (
            <Link href="/signup">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(255,81,47,0.3)] hover:shadow-[0_0_25px_rgba(255,81,47,0.5)] transition-all font-semibold rounded-full px-6">
                {t.nav.getStarted}
              </Button>
            </Link>
          )}
        </div>

        {/* Mobile 3-dot button */}
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
          aria-label="Open menu"
        >
          {mobileOpen ? <X className="w-4 h-4" /> : <MoreVertical className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="md:hidden border-t border-white/5 bg-background/95 backdrop-blur-xl px-4 py-4 space-y-1"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  location === link.href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-white/5 mt-2 flex flex-col gap-2">
              <div className="px-4">
                <LanguageSwitcher />
              </div>
              {user ? (
                <>
                  <div className="flex items-center gap-2 px-4 py-2">
                    <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center">
                      <User className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-sm text-foreground/80 truncate">{user.name}</span>
                  </div>
                  <button
                    onClick={() => { signOut(); setMobileOpen(false); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    {t.nav.signOut}
                  </button>
                </>
              ) : (
                <Link href="/signup" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl">
                    {t.nav.getStarted}
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
