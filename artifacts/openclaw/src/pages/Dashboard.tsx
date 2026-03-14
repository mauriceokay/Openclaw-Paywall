import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  Settings,
  ShieldAlert,
  Sparkles,
  Activity,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useCreatePortalSession, type SubscriptionStatus, type CreatePortalSessionMutationError } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { SEOHead } from "@/components/SEOHead";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export function Dashboard() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const [, navigate] = useLocation();

  const { data: status, isLoading, error } = useQuery<SubscriptionStatus>({
    queryKey: ["subscription-status", user?.email],
    queryFn: async () => {
      const url = user?.email
        ? `${BASE_URL}/api/subscription/status?email=${encodeURIComponent(user.email)}`
        : `${BASE_URL}/api/subscription/status`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    enabled: true,
  });

  const portalMutation = useCreatePortalSession();
  const [portalError, setPortalError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<"openai" | "anthropic" | "gemini">(
    () => (localStorage.getItem("oc_api_provider") as "openai" | "anthropic" | "gemini") ?? "anthropic"
  );

  const handleManageSubscription = () => {
    setPortalError(null);
    portalMutation.mutate(
      { data: { email: user?.email ?? "" } },
      {
        onSuccess: (data) => {
          window.open(data.url, "_blank", "noopener,noreferrer");
        },
        onError: (err: CreatePortalSessionMutationError) => {
          const apiMessage = err?.data?.error ?? null;
          setPortalError(
            apiMessage || "Could not open billing portal. Please try again."
          );
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">Loading workspace...</p>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="min-h-screen pt-32 flex items-center justify-center px-6">
        <Card className="max-w-md w-full border-destructive/20 bg-destructive/5 text-center p-8">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Error</h2>
          <p className="text-muted-foreground mb-6">Could not verify your subscription status.</p>
          <Button onClick={() => window.location.reload()} variant="outline">Try Again</Button>
        </Card>
      </div>
    );
  }

  if (!status.hasActiveSubscription) {
    return (
      <div className="min-h-screen pt-32 pb-24 px-6 flex items-center justify-center relative overflow-hidden bg-mesh">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-md z-0" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="relative z-10 w-full max-w-xl"
        >
          <Card className="glass-panel border-primary/30 shadow-[0_0_50px_rgba(255,81,47,0.15)] p-2">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-3xl font-display mb-2">Premium Workspace</CardTitle>
              <CardDescription className="text-base text-muted-foreground">
                This dashboard is locked. Upgrade your account to manage your OpenClaw gateway, view analytics, and configure advanced routing.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center pt-6 pb-4">
              <Link href="/pricing" className="w-full">
                <Button size="lg" className="w-full h-14 text-lg bg-gradient-to-r from-primary to-[#F09819] hover:opacity-90 shadow-lg text-white font-bold rounded-xl group">
                  View Subscription Plans
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <>
    <SEOHead
      locale={locale}
      title={t.seo.dashboardTitle}
      description={t.seo.dashboardDesc}
      canonicalPath="/dashboard"
      noindex
    />
    <div className="min-h-screen pt-32 pb-24 bg-background">
      <div className="max-w-5xl mx-auto px-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-display font-bold mb-2">Workspace Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back{user?.name ? `, ${user.name}` : ""}. Your gateway is online.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button
              variant="outline"
              onClick={handleManageSubscription}
              disabled={portalMutation.isPending}
              className="border-white/10 hover:bg-white/5"
            >
              {portalMutation.isPending
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Settings className="w-4 h-4 mr-2" />}
              Manage Subscription
            </Button>
            {(portalMutation.isError || portalError) && (
              <p className="text-sm text-destructive max-w-xs text-right">
                {portalError || "Could not open billing portal. Please try again."}
              </p>
            )}
          </div>
        </div>

        {/* Primary CTA — Open OpenClaw */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, type: "spring" }}
          className="mb-10"
        >
          <div className="relative rounded-2xl overflow-hidden border border-primary/30 bg-gradient-to-br from-primary/10 via-[#F09819]/5 to-transparent p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_0_40px_rgba(255,81,47,0.1)]">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-3xl shrink-0">
                🦞
              </div>
              <div>
                <h2 className="text-2xl font-bold font-display mb-1">Your OpenClaw Instance</h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                  Gateway online · Port 3001 · Ready to chat
                </div>
              </div>
            </div>
            <Button
              size="lg"
              className="h-14 px-8 text-lg font-bold bg-gradient-to-r from-primary to-[#F09819] hover:opacity-90 text-white rounded-xl shadow-lg group shrink-0"
              onClick={() => navigate("/openclaw")}
            >
              <Zap className="w-5 h-5 mr-2" />
              Open OpenClaw
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <Card className="bg-card/40 border-white/5 backdrop-blur-lg">
            <CardHeader className="pb-2">
              <CardDescription>Current Plan</CardDescription>
              <CardTitle className="text-2xl text-primary">{status.planName || "Pro Tier"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className={`w-2 h-2 rounded-full ${status.status === "active" ? "bg-green-500" : "bg-yellow-500"}`} />
                Status: {status.status || "Active"}
              </div>
              {status.currentPeriodEnd && (
                <div className="text-sm text-muted-foreground mt-2">
                  Renews: {new Date(Number(status.currentPeriodEnd) * 1000).toLocaleDateString()}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/5 backdrop-blur-lg">
            <CardHeader className="pb-2">
              <CardDescription>Gateway Status</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Activity className="w-6 h-6 text-green-500" />
                Online
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">Listening on port 3001</div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/5 backdrop-blur-lg">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between">
                <span>AI Provider</span>
                <span className="text-xs capitalize px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
                  {localStorage.getItem("oc_mode") ?? "not set"}
                </span>
              </CardDescription>
              <CardTitle className="text-2xl capitalize">
                {selectedProvider === "openai" ? "OpenAI" : selectedProvider === "anthropic" ? "Anthropic" : "Gemini"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                {(["openai", "anthropic", "gemini"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setSelectedProvider(p);
                      localStorage.setItem("oc_api_provider", p);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      selectedProvider === p
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-white/10 text-muted-foreground hover:border-white/30"
                    }`}
                  >
                    {p === "openai" ? "OpenAI" : p === "anthropic" ? "Anthropic" : "Gemini"}
                  </button>
                ))}
              </div>
              <Link href="/setup">
                <span className="text-sm text-primary hover:underline cursor-pointer">Change setup →</span>
              </Link>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
    </>
  );
}
