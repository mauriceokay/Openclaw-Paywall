import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  Settings,
  ShieldAlert,
  Sparkles,
  Activity,
  Zap,
  BarChart2,
  Power,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type SubscriptionStatus } from "@workspace/api-client-react";
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

  // Establish a server-side session cookie so Mission Control can identify the user.
  useEffect(() => {
    if (!user?.email) return;
    fetch(`${BASE_URL}/api/session/establish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email }),
      credentials: "include",
    }).catch(() => {/* best-effort */});
  }, [user?.email]);

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

  const queryClient = useQueryClient();

  const { data: gatewayData, isLoading: gatewayLoading } = useQuery<{ enabled: boolean }>({
    queryKey: ["gateway-status", user?.email],
    queryFn: async () => {
      const url = `${BASE_URL}/api/gateway-control?email=${encodeURIComponent(user!.email)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch gateway status");
      return res.json();
    },
    enabled: !!user?.email,
    retry: false,
  });

  const [toggling, setToggling] = useState(false);
  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch(`${BASE_URL}/api/gateway-control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user!.email, enabled }),
      });
      if (!res.ok) throw new Error("Failed to toggle gateway");
      return res.json() as Promise<{ enabled: boolean }>;
    },
    onMutate: async (enabled) => {
      setToggling(true);
      await queryClient.cancelQueries({ queryKey: ["gateway-status", user?.email] });
      const prev = queryClient.getQueryData<{ enabled: boolean }>(["gateway-status", user?.email]);
      queryClient.setQueryData(["gateway-status", user?.email], { enabled });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["gateway-status", user?.email], ctx.prev);
    },
    onSettled: () => {
      setToggling(false);
      queryClient.invalidateQueries({ queryKey: ["gateway-status", user?.email] });
    },
  });

  const gatewayEnabled = gatewayData?.enabled ?? true;

  const [selectedProvider, setSelectedProvider] = useState<Provider>(
    () => (localStorage.getItem("oc_api_provider") as Provider) ?? "anthropic"
  );
  const [selectedModel, setSelectedModel] = useState<string>(
    () => getValidModel((localStorage.getItem("oc_api_provider") as Provider) ?? "anthropic")
  );

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
            <p className="text-muted-foreground flex items-center gap-2">
              {d.welcomeBack}{user?.name ? `, ${user.name}` : ""}.{" "}
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                gatewayEnabled
                  ? "bg-green-500/15 text-green-400"
                  : "bg-white/5 text-muted-foreground"
              }`}>
                <Power className="w-3 h-3" />
                {gatewayEnabled ? d.gatewayOnline : "Gateway off"}
              </span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/subscription")}
                className="border-white/10 hover:bg-white/5 text-sm"
              >
                <Settings className="w-3.5 h-3.5 mr-1.5" />
                {d.manageSubscription}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/usage")}
                className="border-white/10 hover:bg-white/5 text-sm"
              >
                <BarChart2 className="w-3.5 h-3.5 mr-1.5 text-primary" />
                See Usage
              </Button>
            </div>
          </div>
        </div>

        {/* Primary CTA — Open OpenClaw */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, type: "spring" }}
          className="mb-6 md:mb-10"
        >
          <AnimatePresence mode="wait" initial={false}>
            {gatewayEnabled ? (
              <motion.div
                key="gateway-on"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="relative rounded-2xl overflow-hidden border border-primary/30 bg-gradient-to-br from-primary/10 via-[#F09819]/5 to-transparent p-5 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 shadow-[0_0_40px_rgba(255,81,47,0.1)]"
              >
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-3xl shrink-0">🦞</div>
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
              </motion.div>
            ) : (
              <motion.div
                key="gateway-off"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="relative rounded-2xl overflow-hidden border border-white/10 bg-card/20 p-5 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6"
              >
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-3xl shrink-0 grayscale opacity-50">🦞</div>
                  <div>
                    <h2 className="text-2xl font-bold font-display mb-1 text-muted-foreground">{d.instanceTitle}</h2>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="w-2 h-2 rounded-full bg-white/20 inline-block" />
                      Gateway is turned off
                    </div>
                  </div>
                </div>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 text-lg font-bold border-white/15 hover:bg-white/5 rounded-xl group shrink-0"
                  onClick={() => toggleMutation.mutate(true)}
                  disabled={toggling}
                >
                  {toggling
                    ? <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    : <Power className="w-5 h-5 mr-2 text-green-500" />
                  }
                  Turn Gateway On
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Mission Control */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1, type: "spring" }}
          className="mb-6 md:mb-10"
        >
          <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-card/30 p-5 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/15 flex items-center justify-center shrink-0">
                <Rocket className="w-8 h-8 text-violet-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold font-display mb-1">Mission Control</h2>
                <p className="text-sm text-muted-foreground">Manage agents, tasks, boards, and gateway orchestration</p>
              </div>
            </div>
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-8 text-lg font-bold border-violet-500/30 hover:bg-violet-500/10 text-violet-300 rounded-xl group shrink-0"
              onClick={() => window.open(`${BASE_URL}/mission-control`, "_blank")}
            >
              <Rocket className="w-5 h-5 mr-2" />
              Open Dashboard
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

          <Card className={`border backdrop-blur-lg transition-colors duration-300 ${
            gatewayEnabled
              ? "bg-card/40 border-white/5"
              : "bg-card/20 border-white/5 opacity-80"
          }`}>
            <CardHeader className="pb-2">
              <CardDescription>{d.gatewayStatus}</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <AnimatePresence mode="wait" initial={false}>
                  {gatewayEnabled ? (
                    <motion.div key="on" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.15 }}>
                      <Activity className="w-6 h-6 text-green-500" />
                    </motion.div>
                  ) : (
                    <motion.div key="off" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.15 }}>
                      <Activity className="w-6 h-6 text-muted-foreground" />
                    </motion.div>
                  )}
                </AnimatePresence>
                <span className={gatewayEnabled ? "text-foreground" : "text-muted-foreground"}>
                  {gatewayLoading ? "…" : gatewayEnabled ? d.gatewayOnlineLabel : "Offline"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {gatewayEnabled ? d.listeningOn : "All channels paused"}
                </div>
                <button
                  onClick={() => !toggling && toggleMutation.mutate(!gatewayEnabled)}
                  disabled={toggling || gatewayLoading}
                  aria-label={gatewayEnabled ? "Turn gateway off" : "Turn gateway on"}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed ${
                    gatewayEnabled ? "bg-green-500" : "bg-white/15"
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
                    gatewayEnabled ? "translate-x-5" : "translate-x-0"
                  }`}>
                    {toggling && (
                      <Loader2 className="w-3 h-3 absolute top-1 left-1 animate-spin text-gray-400" />
                    )}
                  </span>
                </button>
              </div>
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
