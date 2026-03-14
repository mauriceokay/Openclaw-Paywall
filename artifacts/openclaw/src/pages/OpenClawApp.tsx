import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, AlertTriangle, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import type { SubscriptionStatus } from "@workspace/api-client-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type ProvisionState = "idle" | "provisioning" | "ready" | "pending" | "error";

function useRelativeTime(date: Date | null) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!date) return;
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, [date]);

  if (!date) return null;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

export function OpenClawApp() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [provisionState, setProvisionState] = useState<ProvisionState>("idle");
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [instanceUrl, setInstanceUrl] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  const relativeTime = useRelativeTime(lastChecked);

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
      credentials: "include",
      body: JSON.stringify({ userId: user.email, email: user.email }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Provision failed");
        return res.json();
      })
      .then(() =>
        fetch(`${BASE_URL}/api/openclaw/instance`, { credentials: "include" })
          .then((r) => r.json())
      )
      .then((data) => {
        if (data.instanceUrl) {
          setInstanceUrl(data.instanceUrl);
          setProvisionState("ready");
        } else {
          setProvisionState("pending");
        }
      })
      .catch((err) => {
        console.error("[openclaw] provision error:", err);
        setProvisionError(err.message);
        setProvisionState("error");
      });
  }, [status?.hasActiveSubscription, user?.email, provisionState]);

  const checkInstanceReady = useCallback(() => {
    if (!user?.email || isChecking) return;
    setIsChecking(true);
    setCheckMessage(null);

    fetch(`${BASE_URL}/api/openclaw/instance`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.instanceUrl) {
          setInstanceUrl(data.instanceUrl);
          setProvisionState("ready");
        } else {
          setCheckMessage("Still being set up — we'll keep checking automatically");
          setTimeout(() => setCheckMessage(null), 4000);
        }
      })
      .catch(() => {
        setCheckMessage("Could not reach the server — try again shortly");
        setTimeout(() => setCheckMessage(null), 4000);
      })
      .finally(() => {
        setIsChecking(false);
        setLastChecked(new Date());
      });
  }, [user?.email, isChecking]);

  useEffect(() => {
    if (provisionState !== "pending") return;
    const interval = setInterval(checkInstanceReady, 30000);
    return () => clearInterval(interval);
  }, [provisionState, checkInstanceReady]);

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

  if (provisionState === "pending") {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Your Instance is Being Set Up</h2>
          <p className="text-muted-foreground mb-4">
            Your personal OpenClaw cloud instance is being provisioned. This usually takes a few minutes.
            This page will automatically update when it's ready.
          </p>
          <Button
            onClick={checkInstanceReady}
            disabled={isChecking}
            variant="outline"
            className="gap-2"
          >
            {isChecking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isChecking ? "Checking…" : "Check Now"}
          </Button>
          {checkMessage && (
            <p className="text-sm text-muted-foreground mt-3 animate-in fade-in duration-300">
              {checkMessage}
            </p>
          )}
          {relativeTime && !checkMessage && (
            <p className="text-xs text-muted-foreground/60 mt-3">
              Last checked: {relativeTime}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (provisionState === "ready" && instanceUrl) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <iframe
          key={iframeKey}
          src={`${BASE_URL}/api/instance-proxy/`}
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
