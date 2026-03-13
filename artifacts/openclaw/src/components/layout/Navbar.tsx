import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function Navbar() {
  const [location] = useLocation();
  const { user, signOut } = useAuth();

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Pricing", href: "/pricing" },
    { label: "Dashboard", href: "/dashboard" },
  ];

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <motion.div
            whileHover={{ rotate: 20, scale: 1.1 }}
            className="text-3xl"
          >
            🦞
          </motion.div>
          <span className="font-display font-bold text-2xl tracking-tight text-gradient">
            OpenClaw
          </span>
        </Link>

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

        <div className="hidden md:flex items-center gap-3">
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
                Sign out
              </Button>
            </>
          ) : (
            <Link href="/signup">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(255,81,47,0.3)] hover:shadow-[0_0_25px_rgba(255,81,47,0.5)] transition-all font-semibold rounded-full px-6">
                Get Started
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
