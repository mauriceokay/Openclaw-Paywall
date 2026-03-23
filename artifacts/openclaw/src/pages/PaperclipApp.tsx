import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type LaunchConfig = {
  launchUrl: string;
};

export function PaperclipApp() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const p = t.paperclipApp;
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [frameSrc, setFrameSrc] = useState<string | null>(null);

  const goToDashboard = () => {
    navigate("/dashboard");
    window.setTimeout(() => {
      if (window.location.pathname.includes("/paperclip-app")) {
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

    fetch(`${BASE_URL}/api/paperclip/launch`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(p.launchNotAvailable);
        }
        return res.json() as Promise<LaunchConfig>;
      })
      .then((launch) => {
        if (cancelled) return;
        const target = new URL(launch.launchUrl, window.location.origin);
        setFrameSrc(`${target.pathname}${target.search}${target.hash}`);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const fallback = err instanceof Error ? err.message : p.unableToOpen;
        setError(fallback);
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
          <h2 className="text-2xl font-bold mb-2">{p.unavailableTitle}</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => navigate("/dashboard")} variant="outline">
            {p.backToDashboard}
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
            {p.backToDashboard}
          </Button>
        </div>
        <iframe
          src={frameSrc}
          className="w-full h-full border-0"
          title="Paperclip"
          allow="clipboard-read; clipboard-write; microphone"
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground">{p.opening}</p>
      </div>
    </div>
  );
}
