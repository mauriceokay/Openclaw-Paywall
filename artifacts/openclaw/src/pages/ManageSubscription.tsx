import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Settings, CreditCard, Calendar, RefreshCcw,
  XCircle, Loader2, AlertCircle, CheckCircle2, ChevronRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useCreatePortalSession, type SubscriptionStatus, type CreatePortalSessionMutationError } from "@workspace/api-client-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function fmt(date: string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export function ManageSubscription() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [portalError, setPortalError] = useState<string | null>(null);
  const portalMutation = useCreatePortalSession();

  useEffect(() => {
    if (!user) navigate("/signup");
  }, [user, navigate]);

  const { data: status, isLoading, error } = useQuery<SubscriptionStatus>({
    queryKey: ["subscription-status", user?.email],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/subscription/status`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    enabled: !!user,
  });

  if (!user) return null;

  const openPortal = () => {
    setPortalError(null);
    portalMutation.mutate(
      { data: { email: user.email ?? "" } },
      {
        onSuccess: (data) => window.open(data.url, "_blank", "noopener,noreferrer"),
        onError: (err: CreatePortalSessionMutationError) => {
          setPortalError(err?.data?.error ?? "Could not open billing portal. Please try again.");
        },
      }
    );
  };

  const actions = [
    {
      icon: CreditCard,
      label: "Update Payment Method",
      desc: "Change your credit or debit card on file.",
    },
    {
      icon: RefreshCcw,
      label: "Change Plan",
      desc: "Upgrade or downgrade your subscription tier.",
    },
    {
      icon: XCircle,
      label: "Cancel Subscription",
      desc: "Cancel at end of current billing period.",
      danger: true,
    },
  ];

  return (
    <div className="min-h-screen md:pt-32 pb-16 bg-background">
      <div className="max-w-2xl mx-auto px-4 md:px-6">

        {/* Back */}
        <Link href="/dashboard">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Dashboard
          </button>
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-1 flex items-center gap-3">
            <Settings className="w-7 h-7 text-primary" />
            Manage Subscription
          </h1>
          <p className="text-muted-foreground text-sm">View and manage your OpenClaw subscription.</p>
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p>Loading subscription…</p>
          </div>
        )}

        {error && (
          <Card className="bg-destructive/5 border-destructive/20 p-6 flex items-start gap-4">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">Could not load subscription</p>
              <p className="text-sm text-muted-foreground mt-1">Please refresh the page or contact support.</p>
            </div>
          </Card>
        )}

        {status && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="space-y-6"
          >
            {/* Subscription summary */}
            <Card className="bg-card/40 border-white/5 backdrop-blur-lg overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-primary via-[#F09819] to-primary" />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardDescription>Current plan</CardDescription>
                    <CardTitle className="text-2xl text-primary mt-0.5">
                      {status.planName || "Active Plan"}
                    </CardTitle>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full mt-1 ${
                    status.status === "active"
                      ? "bg-green-500/15 text-green-400"
                      : "bg-yellow-500/15 text-yellow-400"
                  }`}>
                    <CheckCircle2 className="w-3 h-3" />
                    {status.status ?? "active"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {status.currentPeriodEnd && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4 shrink-0" />
                    {status.cancelAtPeriodEnd
                      ? <span>Cancels on <span className="text-foreground font-medium">{fmt(status.currentPeriodEnd)}</span></span>
                      : <span>Renews on <span className="text-foreground font-medium">{fmt(status.currentPeriodEnd)}</span></span>
                    }
                  </div>
                )}
                {status.cancelAtPeriodEnd && (
                  <div className="flex items-center gap-2 text-yellow-400 bg-yellow-500/10 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Your subscription is set to cancel at the end of this period.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card className="bg-card/40 border-white/5 backdrop-blur-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Billing Actions</CardTitle>
                <CardDescription>Changes are handled securely via Stripe.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {actions.map((action, i) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={i}
                      onClick={openPortal}
                      disabled={portalMutation.isPending}
                      className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-white/5 border-t border-white/5 first:border-t-0 disabled:opacity-60 disabled:cursor-not-allowed ${
                        action.danger ? "hover:bg-destructive/5" : ""
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        action.danger ? "bg-destructive/10" : "bg-white/5"
                      }`}>
                        <Icon className={`w-4 h-4 ${action.danger ? "text-destructive" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${action.danger ? "text-destructive" : "text-foreground"}`}>
                          {action.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
                      </div>
                      {portalMutation.isPending
                        ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      }
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {portalError && (
              <p className="text-sm text-destructive text-center">{portalError}</p>
            )}

            <div className="flex justify-center">
              <Link href="/dashboard">
                <Button variant="outline" className="border-white/10 hover:bg-white/5">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
