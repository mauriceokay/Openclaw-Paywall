import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type LaunchConfig = {
  launchUrl: string;
  authMode: string;
  localAuthToken: string | null;
};

export function MissionControlApp() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [frameSrc, setFrameSrc] = useState<string | null>(null);

  const goToDashboard = () => {
    navigate("/dashboard");
    window.setTimeout(() => {
      if (window.location.pathname.includes("/mission-control-app")) {
        window.location.assign("/dashboard");
      }
    }, 80);
  };

  useEffect(() => {
    if (!user) {
      navigate("/sign-in");
      return;
    }

    let cancelled = false;

    fetch(`${BASE_URL}/api/mission-control/launch`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Mission Control launch is not available");
        }
        return res.json() as Promise<LaunchConfig>;
      })
      .then((launch) => {
        if (cancelled) return;

        const safeEmail = typeof user.email === "string" ? user.email.trim() : "";
        const safeName =
          typeof user.name === "string" && user.name.trim()
            ? user.name.trim()
            : safeEmail || "OpenClaw User";

        localStorage.setItem(
          "oc_user",
          JSON.stringify({
            email: safeEmail,
            name: safeName,
          }),
        );

        if (launch.localAuthToken) {
          sessionStorage.setItem("mc_local_auth_token", launch.localAuthToken);
          localStorage.setItem("mc_local_auth_token", launch.localAuthToken);
        } else if (launch.authMode === "local") {
          throw new Error("Mission Control local auth token is not configured");
        } else {
          // Keep any existing token to avoid forcing a re-login on mixed local/proxy setups.
        }

        // Keep Mission Control on the current app origin so local session/localStorage
        // survive even if the backend accidentally returns a different host/port.
        const target = new URL(launch.launchUrl, window.location.origin);
        setFrameSrc(`${target.pathname}${target.search}${target.hash}`);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unable to open Mission Control";
        setError(message);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, user]);

  if (error) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center max-w-md px-6">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Mission Control unavailable</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => navigate("/dashboard")} variant="outline">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (frameSrc) {
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
            Back to Dashboard
          </Button>
        </div>
        <iframe
          src={frameSrc}
          className="w-full h-full border-0"
          title="Mission Control"
          allow="clipboard-read; clipboard-write; microphone"
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Opening Mission Control...</p>
      </div>
    </div>
  );
}
