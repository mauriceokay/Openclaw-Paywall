import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import type { SubscriptionStatus } from "@workspace/api-client-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type ProvisionState = "idle" | "provisioning" | "ready" | "error";

export function OpenClawApp() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [provisionState, setProvisionState] = useState<ProvisionState>("idle");
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);

  const { data: status, isLoading: statusLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["subscription-status", user?.email],
    queryFn: async () => {
      const url = user?.email
        ? `${BASE_URL}/api/subscription/status?email=${encodeURIComponent(user.email)}`
        : `${BASE_URL}/api/subscription/status`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
  });

  useEffect(() => {
    if (!status?.hasActiveSubscription || !user?.email) return;
    if (provisionState !== "idle") return;

    setProvisionState("provisioning");

    fetch(`${BASE_URL}/api/openclaw/provision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.email, email: user.email }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Provision failed");
        return res.json();
      })
      .then((data) => {
        console.log("[openclaw] agent ready:", data.agent?.agentName);
        setProvisionState("ready");
      })
      .catch((err) => {
        console.error("[openclaw] provision error:", err);
        setProvisionError(err.message);
        setProvisionState("error");
      });
  }, [status?.hasActiveSubscription, user?.email, provisionState]);

  if (statusLoading || provisionState === "provisioning") {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <span className="text-3xl">🦞</span>
            </div>
            <Loader2 className="absolute -bottom-1 -right-1 w-5 h-5 animate-spin text-primary" />
          </div>
          <div className="text-center">
            <p className="font-semibold">
              {provisionState === "provisioning"
                ? "Setting up your OpenClaw workspace…"
                : "Loading OpenClaw…"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">This only takes a moment</p>
          </div>
        </div>
      </div>
    );
  }

  if (!status?.hasActiveSubscription) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center max-w-sm px-6">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Subscription Required</h2>
          <p className="text-muted-foreground mb-6">
            You need an active subscription to access OpenClaw.
          </p>
          <Button onClick={() => navigate("/pricing")} className="bg-primary text-white">
            View Plans
          </Button>
        </div>
      </div>
    );
  }

  if (provisionState === "error") {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center max-w-sm px-6">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Setup Failed</h2>
          <p className="text-muted-foreground mb-4">
            {provisionError || "Could not provision your OpenClaw workspace."}
          </p>
          <Button
            onClick={() => {
              setProvisionState("idle");
              setProvisionError(null);
            }}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (provisionState === "ready") {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <iframe
          key={iframeKey}
          src={`${BASE_URL}/api/gateway/`}
          className="w-full h-full border-0"
          title="OpenClaw"
          allow="clipboard-read; clipboard-write; microphone"
          onError={() => setIframeKey((k) => k + 1)}
        />
      </div>
    );
  }

  return null;
}
