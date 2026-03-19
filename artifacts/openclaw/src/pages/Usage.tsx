import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart2, Calendar, CreditCard, Zap, Loader2, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// Base rate per AI message in USD before provider multiplier
const BASE_RATE_PER_MESSAGE = 0.01;

// Anthropic models get a 0.5x fee; all other providers get 1.5x
const PROVIDER_MULTIPLIERS: Record<string, number> = {
  anthropic: 0.5,
  openai: 1.5,
  gemini: 1.5,
};

function getProviderMultiplier(): number {
  const provider = localStorage.getItem("oc_api_provider") ?? "anthropic";
  return PROVIDER_MULTIPLIERS[provider] ?? 1.5;
}

interface UsageData {
  subscriptionId: string;
  planName: string | null;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  currency: string;
  monthlyAmount: number | null;
  usageItems: Array<{ metric: string; totalUsage: number; unit: string }>;
  trackedEvents?: {
    total: number;
    byType: Record<string, number>;
    recent: Array<{ type: string; createdAt: string }>;
  };
}

function fmt(date: string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function daysLeft(periodEnd: string | null): number {
  if (!periodEnd) return 0;
  const diff = new Date(periodEnd).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function periodProgress(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const now = Date.now();
  return Math.min(100, Math.max(0, ((now - s) / (e - s)) * 100));
}

const EVENT_LABELS: Record<string, string> = {
  terminal_open: "OpenClaw Terminal Opens",
  mission_control_open: "Mission Control Opens",
  gateway_toggle: "Gateway Toggles",
  settings_sync: "Settings Syncs",
  whatsapp_qr_start: "WhatsApp QR Starts",
};

export function Usage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!user) navigate("/signup");
  }, [user, navigate]);

  const { data, isLoading, error } = useQuery<UsageData>({
    queryKey: ["usage", user?.email],
    queryFn: async () => {
      const provider = localStorage.getItem("oc_api_provider") ?? "anthropic";
      const url = `${BASE_URL}/api/subscription/usage?provider=${encodeURIComponent(provider)}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!user?.email,
    retry: 1,
  });

  if (!user) return null;

  const progress = periodProgress(data?.periodStart ?? null, data?.periodEnd ?? null);
  const remaining = daysLeft(data?.periodEnd ?? null);

  return (
    <div className="min-h-screen md:pt-32 pb-16 bg-background">
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        <Link href="/dashboard">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Dashboard
          </button>
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-1 flex items-center gap-3">
            <BarChart2 className="w-7 h-7 text-primary" />
            Usage
          </h1>
          <p className="text-muted-foreground text-sm">Your pay-as-you-go usage for the current billing period.</p>
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p>Loading usage data...</p>
          </div>
        )}

        {error && (
          <Card className="bg-destructive/5 border-destructive/20 p-6 flex items-start gap-4">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">Could not load usage</p>
              <p className="text-sm text-muted-foreground mt-1">
                Make sure you have an active subscription. If the issue persists, contact support.
              </p>
            </div>
          </Card>
        )}

        {data && (() => {
          const multiplier = getProviderMultiplier();
          const ratePerMessage = BASE_RATE_PER_MESSAGE * multiplier;

          return (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
              className="space-y-6"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <Card className="bg-card/40 border-white/5 backdrop-blur-lg">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> Current Plan
                    </CardDescription>
                    <CardTitle className="text-2xl text-primary">{data.planName || "Active Plan"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`w-2 h-2 rounded-full ${data.status === "active" ? "bg-green-500" : "bg-yellow-500"}`} />
                      <span className="capitalize text-muted-foreground">{data.status}</span>
                    </div>
                    {data.monthlyAmount !== null && (
                      <p className="text-sm text-muted-foreground mt-1">${data.monthlyAmount.toFixed(2)} / month</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-card/40 border-white/5 backdrop-blur-lg">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Billing Period
                    </CardDescription>
                    <CardTitle className="text-lg font-semibold">
                      {fmt(data.periodStart)} - {fmt(data.periodEnd)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="w-full bg-white/5 rounded-full h-2 mb-2 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary to-[#F09819] rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {remaining} day{remaining !== 1 ? "s" : ""} remaining in this period
                    </p>
                  </CardContent>
                </Card>
              </div>

              {data.usageItems.length > 0 ? (
                <Card className="bg-card/40 border-white/5 backdrop-blur-lg">
                  <CardHeader>
                    <CardDescription className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-primary" /> Pay-As-You-Go Usage
                    </CardDescription>
                    <CardTitle>This billing period</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {data.usageItems.map((item, i) => {
                      const estimatedCost = item.totalUsage * ratePerMessage;
                      return (
                        <div key={i}>
                          <div className="flex justify-between items-end mb-2">
                            <div>
                              <span className="text-sm font-medium">{item.metric}</span>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Est. cost: <span className="text-foreground font-semibold">${estimatedCost.toFixed(4)}</span>
                                <span className="ml-1 opacity-60">({multiplier}x rate)</span>
                              </p>
                            </div>
                            <span className="text-2xl font-bold text-primary tabular-nums">
                              {item.totalUsage.toLocaleString()}
                              <span className="text-sm font-normal text-muted-foreground ml-1">{item.unit}</span>
                            </span>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-primary to-[#F09819] rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: "60%" }}
                              transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-card/40 border-white/5 backdrop-blur-lg">
                  <CardHeader>
                    <CardDescription className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-primary" /> Pay-As-You-Go Usage
                    </CardDescription>
                    <CardTitle>This billing period</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                        <Zap className="w-7 h-7 text-primary" />
                      </div>
                      <p className="font-semibold mb-1">No metered usage yet</p>
                      <p className="text-sm text-muted-foreground max-w-xs">
                        Usage will appear here once you start using OpenClaw via your connected channels.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-card/40 border-white/5 backdrop-blur-lg">
                <CardHeader>
                  <CardDescription className="flex items-center gap-1.5">
                    <BarChart2 className="w-3.5 h-3.5 text-primary" /> Product Activity (last 30 days)
                  </CardDescription>
                  <CardTitle>OpenClaw + Terminal Tracking</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.trackedEvents?.total ? (
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground">
                        Total tracked events: <span className="text-foreground font-semibold">{data.trackedEvents.total}</span>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(data.trackedEvents.byType).map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{EVENT_LABELS[type] ?? type}</span>
                            <span className="font-semibold tabular-nums">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No tracked activity yet. Open OpenClaw or Mission Control to start tracking usage events.
                    </p>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-center">
                <Link href="/dashboard">
                  <Button variant="outline" className="border-white/10 hover:bg-white/5">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                  </Button>
                </Link>
              </div>
            </motion.div>
          );
        })()}
      </div>
    </div>
  );
}
