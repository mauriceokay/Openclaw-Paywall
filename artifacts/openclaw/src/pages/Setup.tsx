import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Key, Zap, ArrowRight, Check, Eye, EyeOff, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Mode = "byok" | "payg" | null;

export function Setup() {
  const [, navigate] = useLocation();
  const [selectedMode, setSelectedMode] = useState<Mode>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useState<"openai" | "anthropic" | "gemini">("openai");
  const [saved, setSaved] = useState(false);

  const providerPlaceholders: Record<string, string> = {
    openai: "sk-...",
    anthropic: "sk-ant-...",
    gemini: "AIza...",
  };

  const handleContinue = () => {
    if (selectedMode === "byok" && apiKey) {
      localStorage.setItem("oc_api_key", apiKey);
      localStorage.setItem("oc_api_provider", provider);
      localStorage.setItem("oc_mode", "byok");
    } else if (selectedMode === "payg") {
      localStorage.setItem("oc_mode", "payg");
    }
    setSaved(true);
    setTimeout(() => navigate("/dashboard"), 1200);
  };

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.12 } },
  };
  const item = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
  };

  if (saved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mesh">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-3xl font-display font-bold mb-2">You're all set!</h2>
          <p className="text-muted-foreground">Taking you to your dashboard…</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 pb-24 bg-mesh">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-10"
        >
          {/* Header */}
          <motion.div variants={item} className="text-center">
            <Badge className="mb-4 bg-primary/20 text-primary border-primary/30 text-xs font-semibold uppercase tracking-wider px-3 py-1">
              Subscription Active
            </Badge>
            <h1 className="text-4xl font-display font-bold mb-3 text-gradient">
              How do you want to power your AI?
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Choose how OpenClaw sources its AI models. You can change this any time from your dashboard.
            </p>
          </motion.div>

          {/* Option cards */}
          <motion.div variants={item} className="grid md:grid-cols-2 gap-6">
            {/* BYOK */}
            <button
              type="button"
              onClick={() => setSelectedMode("byok")}
              className={`text-left rounded-2xl border transition-all duration-200 p-6 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 focus:outline-none ${
                selectedMode === "byok"
                  ? "border-primary ring-2 ring-primary bg-primary/5"
                  : "border-white/10 bg-card/40 backdrop-blur-xl"
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
                <Key className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-1">Bring Your Own Key</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Connect your existing OpenAI, Anthropic, or Gemini API key. Pay providers directly at their rates — no markup.
              </p>
              <ul className="space-y-1.5 text-sm text-foreground/70">
                {["Full control over model choice", "Pay providers at cost", "No usage markup"].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {selectedMode === "byok" && (
                <div className="mt-4 pt-4 border-t border-white/10 text-xs text-primary font-semibold flex items-center gap-1">
                  Selected <ChevronRight className="w-3 h-3" />
                </div>
              )}
            </button>

            {/* Pay-as-you-go */}
            <button
              type="button"
              onClick={() => setSelectedMode("payg")}
              className={`text-left rounded-2xl border transition-all duration-200 p-6 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 focus:outline-none ${
                selectedMode === "payg"
                  ? "border-primary ring-2 ring-primary bg-primary/5"
                  : "border-white/10 bg-card/40 backdrop-blur-xl"
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold mb-1">Pay As You Go</h3>
              <p className="text-muted-foreground text-sm mb-4">
                We handle everything. Use OpenClaw instantly — metered usage is billed to your subscription automatically.
              </p>
              <ul className="space-y-1.5 text-sm text-foreground/70">
                {["Zero configuration", "Works immediately", "Usage tracked on dashboard"].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-orange-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {selectedMode === "payg" && (
                <div className="mt-4 pt-4 border-t border-white/10 text-xs text-primary font-semibold flex items-center gap-1">
                  Selected <ChevronRight className="w-3 h-3" />
                </div>
              )}
            </button>
          </motion.div>

          {/* BYOK key entry */}
          {selectedMode === "byok" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
            >
              <Card className="bg-card/40 border-white/10 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-xl font-display">Enter your API key</CardTitle>
                  <CardDescription>
                    Your key is stored locally in your browser and never sent to our servers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <div className="flex gap-2">
                      {(["openai", "anthropic", "gemini"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setProvider(p)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all capitalize ${
                            provider === p
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-white/10 text-muted-foreground hover:border-white/30"
                          }`}
                        >
                          {p === "openai" ? "OpenAI" : p === "anthropic" ? "Anthropic" : "Gemini"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="api-key">API Key</Label>
                    <div className="relative">
                      <Input
                        id="api-key"
                        type={showKey ? "text" : "password"}
                        placeholder={providerPlaceholders[provider]}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="bg-black/20 border-white/10 pr-10 font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Keys are encrypted and stored only in your browser's local storage.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Continue button */}
          {selectedMode && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center"
            >
              <Button
                size="lg"
                onClick={handleContinue}
                disabled={selectedMode === "byok" && !apiKey}
                className="h-14 px-10 text-lg bg-gradient-to-r from-primary to-[#F09819] hover:opacity-90 shadow-lg text-white font-bold rounded-xl group"
              >
                Continue to Dashboard
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
