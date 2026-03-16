import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Zap, ArrowRight, Check, Eye, EyeOff, ChevronRight, MessageCircle, Phone, Hash, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/LanguageContext";

type Mode = "byok" | "payg" | null;
type Step = 1 | 2;

const PROVIDER_MODELS = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-3-5"],
  gemini: ["gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-flash"],
} as const;

type Provider = keyof typeof PROVIDER_MODELS;

interface PlatformConfig {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  storageKey: string;
  fields: { key: string; label: string; placeholder: string }[];
  description: string;
}

export function Setup() {
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const s = t.setup;

  const platforms: PlatformConfig[] = [
    {
      id: "telegram",
      name: "Telegram",
      icon: <MessageCircle className="w-6 h-6" />,
      color: "text-sky-400",
      storageKey: "oc_telegram_token",
      fields: [
        { key: "token", label: s.botTokenLabel, placeholder: "123456:ABC-DEF1234ghIkl-zyx57W2v..." },
      ],
      description: s.telegramDesc,
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      icon: <Phone className="w-6 h-6" />,
      color: "text-green-400",
      storageKey: "oc_whatsapp_token",
      fields: [
        { key: "token", label: s.apiTokenLabel, placeholder: "EAAGn..." },
        { key: "phone_id", label: s.phoneIdLabel, placeholder: "10150..." },
      ],
      description: s.whatsappDesc,
    },
    {
      id: "slack",
      name: "Slack",
      icon: <Hash className="w-6 h-6" />,
      color: "text-purple-400",
      storageKey: "oc_slack_token",
      fields: [
        { key: "token", label: s.botTokenLabel, placeholder: "xoxb-..." },
      ],
      description: s.slackDesc,
    },
  ];

  const [step, setStep] = useState<Step>(1);
  const [selectedMode, setSelectedMode] = useState<Mode>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useState<Provider>(
    () => (localStorage.getItem("oc_api_provider") as Provider) ?? "anthropic"
  );
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const p = (localStorage.getItem("oc_api_provider") as Provider) ?? "anthropic";
    const stored = localStorage.getItem("oc_api_model");
    if (stored && (PROVIDER_MODELS[p] as readonly string[]).includes(stored)) return stored;
    return PROVIDER_MODELS[p][0];
  });
  const [saved, setSaved] = useState(false);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [platformInputs, setPlatformInputs] = useState<Record<string, Record<string, string>>>({});
  const [connectedPlatforms, setConnectedPlatforms] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const connected: Record<string, boolean> = {};
    for (const platform of platforms) {
      const stored = localStorage.getItem(platform.storageKey);
      if (stored) {
        connected[platform.id] = true;
      }
    }
    setConnectedPlatforms(connected);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const providerPlaceholders: Record<string, string> = {
    openai: "sk-...",
    anthropic: "sk-ant-...",
    gemini: "AIza...",
  };

  const handleConnectPlatform = (platform: PlatformConfig) => {
    const inputs = platformInputs[platform.id];
    if (!inputs) return;

    const hasAllFields = platform.fields.every((f) => inputs[f.key]?.trim());
    if (!hasAllFields) return;

    if (platform.fields.length === 1) {
      localStorage.setItem(platform.storageKey, inputs[platform.fields[0].key]);
    } else {
      localStorage.setItem(platform.storageKey, JSON.stringify(inputs));
    }

    setConnectedPlatforms((prev) => ({ ...prev, [platform.id]: true }));
    setExpandedPlatform(null);
  };

  const handleDisconnect = (platform: PlatformConfig) => {
    localStorage.removeItem(platform.storageKey);
    setConnectedPlatforms((prev) => {
      const next = { ...prev };
      delete next[platform.id];
      return next;
    });
    setPlatformInputs((prev) => {
      const next = { ...prev };
      delete next[platform.id];
      return next;
    });
  };

  const handleContinue = async () => {
    if (selectedMode === "byok" && apiKey) {
      localStorage.setItem("oc_api_key", apiKey);
      localStorage.setItem("oc_api_provider", provider);
      localStorage.setItem("oc_api_model", selectedModel);
      localStorage.setItem("oc_mode", "byok");
    } else if (selectedMode === "payg") {
      localStorage.setItem("oc_mode", "payg");
    }

    // Build platform token payload from connected platforms
    const telegramStored = localStorage.getItem("oc_telegram_token");
    const slackStored = localStorage.getItem("oc_slack_token");
    const whatsappRaw = localStorage.getItem("oc_whatsapp_token");
    let whatsappToken: string | undefined;
    let whatsappPhoneId: string | undefined;
    if (whatsappRaw) {
      try {
        const parsed = JSON.parse(whatsappRaw) as Record<string, string>;
        whatsappToken = parsed.token;
        whatsappPhoneId = parsed.phone_id;
      } catch {
        whatsappToken = whatsappRaw;
      }
    }

    // Apply config to the OpenClaw gateway automatically
    try {
      await fetch("/api/openclaw/apply-setup-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: selectedMode,
          apiKey: selectedMode === "byok" ? apiKey : undefined,
          provider: selectedMode === "byok" ? provider : undefined,
          model: selectedMode === "byok" ? selectedModel : undefined,
          telegramToken: telegramStored ?? undefined,
          whatsappToken,
          whatsappPhoneId,
          slackToken: slackStored ?? undefined,
        }),
      });
    } catch {
      // Non-critical: gateway may not be running yet; tokens are safely stored in localStorage
    }

    setSaved(true);
    setTimeout(() => navigate("/dashboard"), 1200);
  };

  const updatePlatformInput = (platformId: string, fieldKey: string, value: string) => {
    setPlatformInputs((prev) => ({
      ...prev,
      [platformId]: { ...prev[platformId], [fieldKey]: value },
    }));
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
          <h2 className="text-3xl font-display font-bold mb-2">{s.savedTitle}</h2>
          <p className="text-muted-foreground">{s.savedDesc}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:pt-28 pb-24 bg-mesh">
      <div className="max-w-3xl mx-auto px-6">
        <div className="mb-10">
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-2 group"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step === 1 ? "bg-primary text-white" : "bg-primary/20 text-primary"
              }`}>
                {Object.keys(connectedPlatforms).length > 0 && step === 2 ? (
                  <Check className="w-4 h-4" />
                ) : (
                  "1"
                )}
              </div>
              <span className={`text-sm font-medium transition-colors ${
                step === 1 ? "text-foreground" : "text-muted-foreground"
              }`}>
                {s.step1Label}
              </span>
            </button>

            <div className="w-12 h-px bg-white/20" />

            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex items-center gap-2 group"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step === 2 ? "bg-primary text-white" : "bg-white/10 text-muted-foreground"
              }`}>
                2
              </div>
              <span className={`text-sm font-medium transition-colors ${
                step === 2 ? "text-foreground" : "text-muted-foreground"
              }`}>
                {s.step2Label}
              </span>
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              variants={container}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, x: -40, transition: { duration: 0.2 } }}
              className="space-y-8"
            >
              <motion.div variants={item} className="text-center">
                <Badge className="mb-4 bg-primary/20 text-primary border-primary/30 text-xs font-semibold uppercase tracking-wider px-3 py-1">
                  {s.step1Badge}
                </Badge>
                <h1 className="text-4xl font-display font-bold mb-3 text-gradient">
                  {s.step1Title}
                </h1>
                <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                  {s.step1Desc}
                </p>
              </motion.div>

              <motion.div variants={item} className="space-y-4">
                {platforms.map((platform) => {
                  const isConnected = connectedPlatforms[platform.id];
                  const isExpanded = expandedPlatform === platform.id;

                  return (
                    <div
                      key={platform.id}
                      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                        isConnected
                          ? "border-green-500/40 bg-green-500/5"
                          : isExpanded
                          ? "border-primary/40 bg-primary/5"
                          : "border-white/10 bg-card/40 backdrop-blur-xl hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between p-5">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center ${platform.color}`}>
                            {platform.icon}
                          </div>
                          <div>
                            <h3 className="text-lg font-bold flex items-center gap-2">
                              {platform.name}
                              {isConnected && (
                                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                                  {s.connected}
                                </Badge>
                              )}
                            </h3>
                            <p className="text-muted-foreground text-sm">{platform.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          {isConnected ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDisconnect(platform)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <X className="w-4 h-4 mr-1" />
                              {s.disconnect}
                            </Button>
                          ) : (
                            <Button
                              variant={isExpanded ? "secondary" : "outline"}
                              size="sm"
                              onClick={() => setExpandedPlatform(isExpanded ? null : platform.id)}
                              className={!isExpanded ? "border-white/20 hover:border-primary/40" : ""}
                            >
                              {isExpanded ? s.cancel : s.connect}
                            </Button>
                          )}
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && !isConnected && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="px-5 pb-5 pt-1 border-t border-white/10">
                              <div className="space-y-4 mt-4">
                                {platform.fields.map((field) => (
                                  <div key={field.key} className="space-y-2">
                                    <Label>{field.label}</Label>
                                    <Input
                                      type="password"
                                      placeholder={field.placeholder}
                                      value={platformInputs[platform.id]?.[field.key] || ""}
                                      onChange={(e) => updatePlatformInput(platform.id, field.key, e.target.value)}
                                      className="bg-black/20 border-white/10 font-mono text-sm"
                                    />
                                  </div>
                                ))}
                                <Button
                                  size="sm"
                                  onClick={() => handleConnectPlatform(platform)}
                                  disabled={!platform.fields.every(
                                    (f) => platformInputs[platform.id]?.[f.key]?.trim()
                                  )}
                                  className="bg-gradient-to-r from-primary to-[#F09819] hover:opacity-90 text-white font-semibold"
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  {s.saveConnection}
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </motion.div>

              <motion.div variants={item} className="flex flex-col items-center gap-3 pt-2">
                <Button
                  size="lg"
                  onClick={() => setStep(2)}
                  className="h-14 px-10 text-lg bg-gradient-to-r from-primary to-[#F09819] hover:opacity-90 shadow-lg text-white font-bold rounded-xl group"
                >
                  {s.continue}
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {s.skipForNow}
                </button>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              variants={container}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
              className="space-y-10"
            >
              <motion.div variants={item} className="text-center">
                <Badge className="mb-4 bg-primary/20 text-primary border-primary/30 text-xs font-semibold uppercase tracking-wider px-3 py-1">
                  {s.step2Badge}
                </Badge>
                <h1 className="text-4xl font-display font-bold mb-3 text-gradient">
                  {s.step2Title}
                </h1>
                <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                  {s.step2Desc}
                </p>
              </motion.div>

              <motion.div variants={item} className="grid md:grid-cols-2 gap-6">
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
                  <h3 className="text-xl font-bold mb-1">{s.byokTitle}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{s.byokDesc}</p>
                  <ul className="space-y-1.5 text-sm text-foreground/70">
                    {(s.byokFeatures as readonly string[]).map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {selectedMode === "byok" && (
                    <div className="mt-4 pt-4 border-t border-white/10 text-xs text-primary font-semibold flex items-center gap-1">
                      {s.selected} <ChevronRight className="w-3 h-3" />
                    </div>
                  )}
                </button>

                <div className="relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="inline-flex items-center gap-1.5 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg shadow-green-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />
                      Recommended
                    </span>
                  </div>
                <button
                  type="button"
                  onClick={() => setSelectedMode("payg")}
                  className={`w-full text-left rounded-2xl border transition-all duration-200 p-6 hover:border-green-500/40 hover:shadow-lg hover:shadow-green-500/10 focus:outline-none ${
                    selectedMode === "payg"
                      ? "border-green-500 ring-2 ring-green-500 bg-green-500/5"
                      : "border-green-500/30 bg-card/40 backdrop-blur-xl"
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4">
                    <Zap className="w-6 h-6 text-orange-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-1">{s.paygTitle}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{s.paygDesc}</p>
                  <ul className="space-y-1.5 text-sm text-foreground/70">
                    {(s.paygFeatures as readonly string[]).map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-orange-400 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {selectedMode === "payg" && (
                    <div className="mt-4 pt-4 border-t border-white/10 text-xs text-green-400 font-semibold flex items-center gap-1">
                      {s.selected} <ChevronRight className="w-3 h-3" />
                    </div>
                  )}
                </button>
                </div>
              </motion.div>

              {selectedMode === "byok" && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                >
                  <Card className="bg-card/40 border-white/10 backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="text-xl font-display">{s.apiKeyTitle}</CardTitle>
                      <CardDescription>{s.apiKeyDesc}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="space-y-2">
                        <Label>{s.providerLabel}</Label>
                        <div className="flex gap-2">
                          {(["openai", "anthropic", "gemini"] as const).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => {
                                setProvider(p);
                                const stored = localStorage.getItem("oc_api_model");
                                const newModel = stored && (PROVIDER_MODELS[p] as readonly string[]).includes(stored)
                                  ? stored
                                  : PROVIDER_MODELS[p][0];
                                setSelectedModel(newModel);
                              }}
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
                        <Label>{s.modelLabel}</Label>
                        <div className="flex flex-wrap gap-2">
                          {PROVIDER_MODELS[provider].map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setSelectedModel(m)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                                selectedModel === m
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-white/10 text-muted-foreground hover:border-white/30"
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="api-key">{s.apiKeyLabel}</Label>
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
                        <p className="text-xs text-muted-foreground">{s.apiKeyNote}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

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
                    {s.saveAndContinue}
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
