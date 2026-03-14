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

const PROVIDER_MODELS = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-3-5"],
  gemini: ["gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-flash"],
} as const;

type Provider = keyof typeof PROVIDER_MODELS;

function getValidModel(provider: Provider): string {
  const stored = localStorage.getItem("oc_api_model");
  if (stored && (PROVIDER_MODELS[provider] as readonly string[]).includes(stored)) return stored;
  return PROVIDER_MODELS[provider][0];
}

export function Dashboard() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const d = t.dashboard;
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
  const [selectedProvider, setSelectedProvider] = useState<Provider>(
    () => (localStorage.getItem("oc_api_provider") as Provider) ?? "anthropic"
  );
  const [selectedModel, setSelectedModel] = useState<string>(
    () => getValidModel((localStorage.getItem("oc_api_provider") as Provider) ?? "anthropic")
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
            apiMessage || d.portalError
          );
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen md:pt-32 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">{d.loadingWorkspace}</p>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="min-h-screen md:pt-32 flex items-center justify-center px-6">
        <Card className="max-w-md w-full border-destructive/20 bg-destructive/5 text-center p-8">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">{d.accessError}</h2>
          <p className="text-muted-foreground mb-6">{d.accessErrorDesc}</p>
          <Button onClick={() => window.location.reload()} variant="outline">{d.tryAgain}</Button>
        </Card>
      </div>
    );
  }

  if (!status.hasActiveSubscription) {
    return (
      <div className="min-h-screen md:pt-32 pb-24 px-6 flex items-center justify-center relative overflow-hidden bg-mesh">
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
              <CardTitle className="text-3xl font-display mb-2">{d.premiumTitle}</CardTitle>
              <CardDescription className="text-base text-muted-foreground">
                {d.premiumDesc}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center pt-6 pb-4">
              <Link href="/pricing" className="w-full">
                <Button size="lg" className="w-full h-14 text-lg bg-gradient-to-r from-primary to-[#F09819] hover:opacity-90 shadow-lg text-white font-bold rounded-xl group">
                  {d.viewPlans}
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
    <div className="min-h-screen md:pt-32 pb-12 md:pb-24 bg-background">
      <div className="max-w-5xl mx-auto px-4 md:px-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6 md:mb-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-1 md:mb-2">{d.title}</h1>
            <p className="text-muted-foreground">
              {d.welcomeBack}{user?.name ? `, ${user.name}` : ""}. {d.gatewayOnline}
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
              {d.manageSubscription}
            </Button>
            {(portalMutation.isError || portalError) && (
              <p className="text-sm text-destructive max-w-xs text-right">
                {portalError || d.portalError}
              </p>
            )}
          </div>
        </div>

        {/* Primary CTA — Open OpenClaw */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, type: "spring" }}
          className="mb-6 md:mb-10"
        >
          <div className="relative rounded-2xl overflow-hidden border border-primary/30 bg-gradient-to-br from-primary/10 via-[#F09819]/5 to-transparent p-5 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 shadow-[0_0_40px_rgba(255,81,47,0.1)]">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-3xl shrink-0">
                🦞
              </div>
              <div>
                <h2 className="text-2xl font-bold font-display mb-1">{d.instanceTitle}</h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                  {d.instanceStatus}
                </div>
              </div>
            </div>
            <Button
              size="lg"
              className="h-14 px-8 text-lg font-bold bg-gradient-to-r from-primary to-[#F09819] hover:opacity-90 text-white rounded-xl shadow-lg group shrink-0"
              onClick={() => navigate("/openclaw")}
            >
              <Zap className="w-5 h-5 mr-2" />
              {d.openInstance}
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-10">
          <Card className="bg-card/40 border-white/5 backdrop-blur-lg">
            <CardHeader className="pb-2">
              <CardDescription>{d.currentPlan}</CardDescription>
              <CardTitle className="text-2xl text-primary">{status.planName || d.defaultPlan}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className={`w-2 h-2 rounded-full ${status.status === "active" ? "bg-green-500" : "bg-yellow-500"}`} />
                {d.statusLabel}: {status.status || d.defaultStatus}
              </div>
              {status.currentPeriodEnd && (
                <div className="text-sm text-muted-foreground mt-2">
                  {d.renewsLabel}: {new Date(Number(status.currentPeriodEnd) * 1000).toLocaleDateString()}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/5 backdrop-blur-lg">
            <CardHeader className="pb-2">
              <CardDescription>{d.gatewayStatus}</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Activity className="w-6 h-6 text-green-500" />
                {d.gatewayOnlineLabel}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">{d.listeningOn}</div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/5 backdrop-blur-lg">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between">
                <span>{d.aiProvider}</span>
                <span className="text-xs capitalize px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
                  {localStorage.getItem("oc_mode") ?? d.modeNotSet}
                </span>
              </CardDescription>
              <CardTitle className="text-lg">
                {selectedProvider === "openai" ? "OpenAI" : selectedProvider === "anthropic" ? "Anthropic" : "Gemini"}
                <span className="text-muted-foreground font-normal"> · </span>
                <span className="text-base text-muted-foreground font-normal">{selectedModel}</span>
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
                      const stored = localStorage.getItem("oc_api_model");
                      const newModel = stored && (PROVIDER_MODELS[p] as readonly string[]).includes(stored)
                        ? stored
                        : PROVIDER_MODELS[p][0];
                      setSelectedModel(newModel);
                      localStorage.setItem("oc_api_model", newModel);
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
              <div className="flex flex-wrap gap-1.5">
                {PROVIDER_MODELS[selectedProvider].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setSelectedModel(m);
                      localStorage.setItem("oc_api_model", m);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${
                      selectedModel === m
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-white/10 text-muted-foreground hover:border-white/30"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <Link href="/setup">
                <span className="text-sm text-primary hover:underline cursor-pointer">{d.changeSetup}</span>
              </Link>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
    </>
  );
}
