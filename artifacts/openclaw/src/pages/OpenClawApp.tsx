import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, AlertTriangle, RefreshCw, Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import type { SubscriptionStatus } from "@workspace/api-client-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type ProvisionState = "idle" | "provisioning" | "ready" | "pending" | "error";

interface InstanceResponse {
  instanceUrl: string | null;
  ready?: boolean;
  localDev?: boolean;
}

type OpenClawLaunchConfig = {
  launchUrl?: string;
};

function normalizeGatewayTokenScope(gatewayUrl: string): string {
  const trimmed = gatewayUrl.trim();
  if (!trimmed) return "default";
  try {
    const parsed = new URL(trimmed, window.location.href);
    const pathname =
      parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "") || parsed.pathname;
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return trimmed;
  }
}

function getWorkspaceSlug(email: string): string {
  return btoa(email.toLowerCase())
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .slice(0, 12);
}

function withLocale(url: string, locale: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.set("oc_lang", locale);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

function preloadOpenClawControlUi(locale: string, launchUrl?: string) {
  const defaultGatewayUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/gateway`;
  let gatewayUrl = defaultGatewayUrl;
  let token = "";

  if (launchUrl) {
    try {
      const parsed = new URL(launchUrl, window.location.origin);
      const queryParams = parsed.searchParams;
      const hashParams = new URLSearchParams(parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash);
      const fromQuery = queryParams.get("gatewayUrl")?.trim();
      if (fromQuery) gatewayUrl = fromQuery;
      token = hashParams.get("token")?.trim() ?? "";
    } catch {
      // fall back to current host
    }
  }

  localStorage.setItem(
    "openclaw.control.settings.v1",
    JSON.stringify({
      gatewayUrl,
      locale,
      sessionKey: "main",
      lastActiveSessionKey: "main",
      theme: "claw",
      themeMode: "system",
      chatFocusMode: false,
      chatShowThinking: true,
      splitRatio: 0.6,
      navCollapsed: false,
      navWidth: 220,
      navGroupsCollapsed: {},
    }),
  );

  if (token) {
    const key = `openclaw.control.token.v1:${normalizeGatewayTokenScope(gatewayUrl)}`;
    sessionStorage.setItem(key, token);
  }
}

function useRelativeTime(
  date: Date | null,
  labels: { justNow: string; secondsAgoSuffix: string; minutesAgoSuffix: string },
) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!date) return;
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, [date]);

  if (!date) return null;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return labels.justNow;
  if (seconds < 60) return `${seconds}${labels.secondsAgoSuffix}`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}${labels.minutesAgoSuffix}`;
}

export function OpenClawApp() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const o = t.openclawApp;
  const [location, navigate] = useLocation();
  const [provisionState, setProvisionState] = useState<ProvisionState>("idle");
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [instanceUrl, setInstanceUrl] = useState<string | null>(null);
  const [instanceIsLocalDev, setInstanceIsLocalDev] = useState(false);
  const [launchUrl, setLaunchUrl] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  const relativeTime = useRelativeTime(lastChecked, {
    justNow: o.justNow,
    secondsAgoSuffix: o.secondsAgoSuffix,
    minutesAgoSuffix: o.minutesAgoSuffix,
  });

  const goToDashboard = useCallback(() => {
    navigate("/dashboard");
    window.setTimeout(() => {
      if (window.location.pathname.includes("/openclaw")) {
        window.location.assign("/dashboard");
      }
    }, 80);
  }, [navigate]);

  useEffect(() => {
    if (!user?.email) return;
    if (!/^\/openclaw\/?$/.test(location)) return;
    navigate(`/openclaw/${getWorkspaceSlug(user.email)}`);
  }, [location, navigate, user?.email]);

  const { data: status, isLoading: statusLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["subscription-status", user?.email],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (user?.email) params.set("email", user.email);
      const checkoutSessionId = localStorage.getItem("oc_checkout_session_id");
      if (checkoutSessionId) params.set("sessionId", checkoutSessionId);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${BASE_URL}/api/subscription/status${suffix}`, { credentials: "include" });
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
          .then((r) => r.json() as Promise<InstanceResponse>)
      )
      .then((data) => {
        if (data.instanceUrl) {
          setInstanceUrl(data.instanceUrl);
          setInstanceIsLocalDev(Boolean(data.localDev));
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
      .then((res) => res.json() as Promise<InstanceResponse>)
      .then((data) => {
        if (data.instanceUrl) {
          setInstanceUrl(data.instanceUrl);
          setInstanceIsLocalDev(Boolean(data.localDev));
          setProvisionState("ready");
        } else {
          setCheckMessage(o.stillSettingUp);
          setTimeout(() => setCheckMessage(null), 4000);
        }
      })
      .catch(() => {
        setCheckMessage(o.serverUnreachable);
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

  useEffect(() => {
    if (provisionState !== "ready") return;
    if (!instanceUrl) return;

    let cancelled = false;
    fetch(`${BASE_URL}/api/openclaw/launch`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return {};
        return (await res.json()) as OpenClawLaunchConfig;
      })
      .then((launch) => {
        if (cancelled) return;
        const resolvedLaunchUrl = withLocale(
          launch.launchUrl?.trim() || `${BASE_URL}/api/gateway/chat`,
          locale,
        );
        setLaunchUrl(resolvedLaunchUrl);
        preloadOpenClawControlUi(locale, resolvedLaunchUrl);
      })
      .catch(() => {
        if (cancelled) return;
        const fallback = withLocale(`${BASE_URL}/api/gateway/chat`, locale);
        setLaunchUrl(fallback);
        preloadOpenClawControlUi(locale, fallback);
      });

    return () => {
      cancelled = true;
    };
  }, [instanceUrl, locale, provisionState]);

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
                ? o.settingUpWorkspace
                : o.loadingOpenClaw}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{o.takesMoment}</p>
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
          <h2 className="text-2xl font-bold mb-2">{o.subscriptionRequiredTitle}</h2>
          <p className="text-muted-foreground mb-6">
            {o.subscriptionRequiredDesc}
          </p>
          <Button onClick={() => navigate("/pricing")} className="bg-primary text-white">
            {o.viewPlans}
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
          <h2 className="text-2xl font-bold mb-2">{o.setupFailedTitle}</h2>
          <p className="text-muted-foreground mb-4">
            {provisionError || o.setupFailedDesc}
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
            {o.retry}
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
          <h2 className="text-2xl font-bold mb-2">{o.instanceSetupTitle}</h2>
          <p className="text-muted-foreground mb-4">
            {o.instanceSetupDesc}
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
            {isChecking ? o.checking : o.checkNow}
          </Button>
          {checkMessage && (
            <p className="text-sm text-muted-foreground mt-3 animate-in fade-in duration-300">
              {checkMessage}
            </p>
          )}
          {relativeTime && !checkMessage && (
            <p className="text-xs text-muted-foreground/60 mt-3">
              {o.lastCheckedLabel}: {relativeTime}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (provisionState === "ready" && instanceUrl) {
    const frameSrc = launchUrl || `${BASE_URL}/api/gateway/chat`;
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <div className="absolute top-4 left-4 z-10">
          <Button
            variant="outline"
            size="sm"
            onClick={goToDashboard}
            className="border-white/20 bg-background/80 backdrop-blur hover:bg-background"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            {o.backToDashboard}
          </Button>
        </div>
        <iframe
          key={iframeKey}
          src={frameSrc}
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
