import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, User, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { SEOHead } from "@/components/SEOHead";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export function SignUp() {
  const { signUp, user } = useAuth();
  const { t, locale } = useLanguage();
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate("/pricing");
  }, [user, navigate]);

  if (user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    setError(null);

    try {
      await fetch(`${BASE_URL}/api/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
    } catch {
      // Non-fatal — still continue even if DB save fails
    }

    signUp(name.trim(), email.trim());
    navigate("/pricing");
    setLoading(false);
  };

  return (
    <>
    <SEOHead
      locale={locale}
      title={t.seo.signupTitle}
      description={t.seo.signupDesc}
      canonicalPath="/signup"
    />
    <div className="min-h-screen flex items-center justify-center bg-mesh px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            whileHover={{ rotate: 15, scale: 1.1 }}
            className="text-5xl mb-4 inline-block"
          >
            🦞
          </motion.div>
          <h1 className="text-3xl font-display font-bold mb-2 text-gradient">
            Get started with OpenClaw
          </h1>
          <p className="text-muted-foreground">
            Create your account to access plans and your AI gateway.
          </p>
        </div>

        <Card className="bg-card/40 backdrop-blur-xl border-white/10">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-display">Create your account</CardTitle>
            <CardDescription>No credit card required to start.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Jane Smith"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9 bg-black/20 border-white/10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 bg-black/20 border-white/10"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-primary to-[#F09819] hover:opacity-90 text-white font-semibold rounded-xl group"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Continue to Pricing
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>

            <p className="text-xs text-muted-foreground text-center mt-4">
              By signing up you agree to our terms of service and privacy policy.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
    </>
  );
}
