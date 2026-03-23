import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Rocket, TerminalSquare, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type NemoStatus = {
  installed: boolean;
  ready: boolean;
  version: string | null;
  output: string;
  error: string;
};

type ActionResponse = {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
};

export function NemoClawApp() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const n = t.nemoClawApp;
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<NemoStatus | null>(null);
  const [logOutput, setLogOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function fetchStatus() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/api/nemoclaw/status`, { credentials: "include" });
      if (!res.ok) throw new Error(n.loadStatusError);
      const payload = (await res.json()) as NemoStatus;
      setStatus(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : n.loadError);
    } finally {
      setLoading(false);
    }
  }

  async function runAction(path: "onboard" | "start") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/api/nemoclaw/${path}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${n.actionErrorPrefix} ${path} NemoClaw`);
      const payload = (await res.json()) as ActionResponse;
      const out = `${payload.stdout ?? ""}\n${payload.stderr ?? ""}`.trim();
      setLogOutput(out || `${n.commandCompleted} (${path})`);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : n.actionFailed);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!user) {
      navigate("/sign-in");
      return;
    }
    void fetchStatus();
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-auto">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="mb-5 border-white/20 bg-background/80 backdrop-blur hover:bg-background"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          {n.backToDashboard}
        </Button>

        <Card className="border-white/10 bg-card/40">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Rocket className="w-6 h-6 text-cyan-300" />
              {n.title}
            </CardTitle>
            <CardDescription>
              {n.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                {n.loadingStatus}
              </div>
            ) : status ? (
              <div className="grid md:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border border-white/10 p-3">
                  <div className="text-muted-foreground">{n.installedLabel}</div>
                  <div className="font-semibold">{status.installed ? n.yes : n.no}</div>
                </div>
                <div className="rounded-lg border border-white/10 p-3">
                  <div className="text-muted-foreground">{n.readyLabel}</div>
                  <div className="font-semibold">{status.ready ? n.yes : n.no}</div>
                </div>
                <div className="rounded-lg border border-white/10 p-3">
                  <div className="text-muted-foreground">{n.versionLabel}</div>
                  <div className="font-semibold truncate">{status.version || "-"}</div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => runAction("onboard")} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TerminalSquare className="w-4 h-4 mr-2" />}
                {n.runOnboard}
              </Button>
              <Button variant="outline" onClick={() => runAction("start")} disabled={busy}>
                {n.startServices}
              </Button>
              <Button variant="outline" onClick={() => navigate("/openclaw")} disabled={busy}>
                {n.openOpenClaw}
              </Button>
              <Button variant="outline" onClick={() => fetchStatus()} disabled={busy}>
                {n.refreshStatus}
              </Button>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-200 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="rounded-lg border border-white/10 p-3">
              <div className="text-sm text-muted-foreground mb-2">{n.runtimeOutput}</div>
              <pre className="text-xs whitespace-pre-wrap text-foreground/90 min-h-28">{logOutput || status?.output || status?.error || n.noOutputYet}</pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
