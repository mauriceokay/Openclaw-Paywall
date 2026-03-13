import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  Settings,
  ShieldAlert,
  Sparkles,
  Activity,
  ExternalLink,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useCreatePortalSession, type SubscriptionStatus } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const GATEWAY_PATH = `${BASE_URL}/api/gateway/`;

export function Dashboard() {
  const { user } = useAuth();
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

  const handleManageSubscription = () => {
    portalMutation.mutate(
      { data: { email: user?.email ?? "" } },
      {
        onSuccess: (data) => {
          window.location.href = data.url;
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
    <div className="min-h-screen pt-32 pb-24 bg-background">
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-display font-bold mb-2">Workspace Dashboard</h1>
            <p className="text-muted-foreground">Welcome back. Your gateway is active and fully operational.</p>
          </div>
          <Button
            variant="outline"
            onClick={handleManageSubscription}
            disabled={portalMutation.isPending}
            className="border-white/10 hover:bg-white/5"
          >
            {portalMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Settings className="w-4 h-4 mr-2" />}
            Manage Subscription
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
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
              <div className="text-sm text-muted-foreground">
                Listening on port 3001
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/5 backdrop-blur-lg">
            <CardHeader className="pb-2">
              <CardDescription>AI Mode</CardDescription>
              <CardTitle className="text-2xl capitalize">
                {localStorage.getItem("oc_mode") ?? "Not configured"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/setup">
                <span className="text-sm text-primary hover:underline cursor-pointer">
                  Change setup →
                </span>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* OpenClaw Control Panel */}
        <div className="glass-panel rounded-2xl border-white/5 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Terminal className="w-5 h-5 text-primary" />
              OpenClaw Control Panel
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground gap-1.5"
              onClick={() => window.open(GATEWAY_PATH, "_blank")}
            >
              <ExternalLink className="w-4 h-4" />
              Open in new tab
            </Button>
          </div>
          <div className="w-full" style={{ height: "640px" }}>
            <iframe
              src={GATEWAY_PATH}
              className="w-full h-full border-0"
              title="OpenClaw Control Panel"
              allow="clipboard-read; clipboard-write"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
