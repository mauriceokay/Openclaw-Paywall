import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import type { SubscriptionStatus } from "@workspace/api-client-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// Build the gateway iframe src: proxy path + ?gatewayUrl= so the control panel
// pre-fills and auto-connects to the WebSocket via our proxy
function buildIframeSrc(): string {
  const domain = window.location.hostname;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${domain}/api/gateway`;
  const proxyBase = `${BASE_URL}/api/gateway/`;
  return `${proxyBase}?gatewayUrl=${encodeURIComponent(wsUrl)}`;
}

export function OpenClawApp() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [iframeSrc] = useState(buildIframeSrc);

  const { data: status, isLoading } = useQuery<SubscriptionStatus>({
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

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Starting your instance…</p>
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

  return (
    <div className="fixed inset-0 bg-background flex flex-col z-50">
      {/* Thin top bar */}
      <div className="flex items-center gap-3 px-4 h-10 border-b border-white/5 bg-black/40 backdrop-blur shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Dashboard
        </Button>
        <div className="flex items-center gap-2 ml-1">
          <span className="text-base">🦞</span>
          <span className="text-sm font-semibold text-foreground/80">OpenClaw</span>
          {user?.name && (
            <span className="text-xs text-muted-foreground">· {user.name}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-muted-foreground">Gateway online</span>
        </div>
      </div>

      {/* Full-screen gateway control panel — pre-filled with gatewayUrl param */}
      <iframe
        src={iframeSrc}
        className="flex-1 w-full border-0"
        title="OpenClaw"
        allow="clipboard-read; clipboard-write; microphone"
      />
    </div>
  );
}
