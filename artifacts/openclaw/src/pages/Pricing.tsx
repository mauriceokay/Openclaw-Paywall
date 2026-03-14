import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, X, ArrowLeft, Zap } from "lucide-react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { useListProducts, createCheckout } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { SEOHead } from "@/components/SEOHead";

type Interval = "month" | "year";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 15,
    yearlyPrice: 12,
    description: "Perfect for personal use and getting started with AI automation.",
    features: [
      "5 Channel Integrations",
      "500 AI messages / month",
      "Basic Automations",
      "Email Support",
      "1 Cloud Instance",
    ],
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 35,
    yearlyPrice: 28,
    description: "For power users who want full automation and unlimited integrations.",
    features: [
      "All 20+ Channel Integrations",
      "Unlimited AI messages",
      "Advanced Automations (Cron/Webhooks)",
      "Priority Model Routing",
      "Priority Support",
      "3 Cloud Instances",
    ],
    highlight: true,
  },
  {
    id: "team",
    name: "Team",
    monthlyPrice: 79,
    yearlyPrice: 63,
    description: "Built for teams and agencies managing multiple AI assistants.",
    features: [
      "Everything in Pro",
      "Unlimited Cloud Instances",
      "Team Member Access",
      "Custom Integrations",
      "Dedicated Support",
      "SLA Guarantee",
    ],
    highlight: false,
  },
];

export function Pricing() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const [, navigate] = useLocation();
  const { data: productsData } = useListProducts();

  const [interval, setInterval] = useState<Interval>("month");
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [step, setStep] = useState<"idle" | "checkout">("idle");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { navigate("/signup"); return; }
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg) => { if (cfg.stripePublishableKey) setStripePromise(loadStripe(cfg.stripePublishableKey)); })
      .catch(() => {});
  }, [user, navigate]);

  if (!user) return null;

  const findStripePrice = (plan: typeof PLANS[number]) => {
    if (!productsData?.products) return null;
    const targetCents = (interval === "month" ? plan.monthlyPrice : plan.yearlyPrice * 12) * 100;
    for (const product of productsData.products) {
      const n = product.name.toLowerCase();
      if (!n.startsWith("openclaw") || n.includes("hosting")) continue;
      const price = product.prices.find(
        (p) => p.interval === interval && p.unitAmount === targetCents
      ) ?? product.prices.find((p) => p.interval === interval);
      if (price) return price.id;
    }
    return productsData.products
      .filter((p) => {
        const n = p.name.toLowerCase();
        return n.startsWith("openclaw") && !n.includes("hosting") && !n.includes("free");
      })
      .flatMap((p) => p.prices)
      .find((p) => p.interval === interval)?.id ?? null;
  };

  const handleSubscribeClick = async (plan: typeof PLANS[number]) => {
    if (!user) { navigate("/signup"); return; }
    setSelectedPlanId(plan.id);
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const priceId = findStripePrice(plan);
      if (!priceId) throw new Error("Plan not yet available. Please try again soon.");
      const mockUserId = `usr_${Math.random().toString(36).slice(2, 9)}`;
      const data = await createCheckout({ priceId, userId: mockUserId, email: user.email });
      setClientSecret(data.clientSecret);
      setStep("checkout");
    } catch (err: any) {
      setCheckoutError(err?.message || "Failed to start checkout. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleClose = () => {
    setStep("idle");
    setClientSecret(null);
    setSelectedPlanId(null);
    setCheckoutError(null);
  };

  const fetchClientSecret = useCallback(() => Promise.resolve(clientSecret!), [clientSecret]);

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.12 } },
  };
  const item = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
  };

  const yearlySavingsPct = Math.round((1 - 28 / 35) * 100);

  return (
    <>
    <SEOHead
      locale={locale}
      title={t.seo.pricingTitle}
      description={t.seo.pricingDesc}
      canonicalPath="/pricing"
      keywords="openclaw pricing, openclaw cloud plans, ai assistant subscription"
    />
    <div className="min-h-screen pt-20 md:pt-32 pb-16 md:pb-24 bg-mesh">
      <div className="max-w-6xl mx-auto px-4 md:px-6">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 md:mb-14">
          <h1 className="text-3xl md:text-5xl font-display font-bold mb-4 md:mb-6 text-gradient">
            Simple, transparent pricing
          </h1>
          <p className="text-base md:text-lg text-muted-foreground mb-8">
            Unlock the full potential of your personal AI assistant — all channel integrations, unlimited automations, and cloud hosting included.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-1 bg-card/60 border border-white/10 rounded-full p-1 backdrop-blur-sm">
            <button
              onClick={() => setInterval("month")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                interval === "month"
                  ? "bg-white/10 text-white shadow"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval("year")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                interval === "year"
                  ? "bg-white/10 text-white shadow"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Yearly
              <span className="bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                -{yearlySavingsPct}%
              </span>
            </button>
          </div>

          {checkoutError && (
            <p className="mt-4 text-sm text-destructive">{checkoutError}</p>
          )}
        </div>

        {/* Plan Cards */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid md:grid-cols-3 gap-6 md:gap-8"
        >
          {PLANS.map((plan) => {
            const displayPrice = interval === "month" ? plan.monthlyPrice : plan.yearlyPrice;
            const isLoadingCard = checkoutLoading && selectedPlanId === plan.id;

            return (
              <motion.div key={plan.id} variants={item} className="h-full">
                <Card className={`h-full flex flex-col relative overflow-hidden backdrop-blur-xl transition-all duration-300 hover:shadow-2xl ${
                  plan.highlight
                    ? "bg-gradient-to-b from-primary/10 to-card/40 border-primary/40 ring-2 ring-primary hover:ring-primary/80"
                    : "bg-card/40 border-white/5 hover:border-white/20"
                }`}>
                  {plan.highlight && (
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-[#F09819] to-primary" />
                  )}

                  <CardHeader className="pb-4 pt-6 px-6">
                    {plan.highlight && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <Zap className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-bold tracking-wider uppercase text-primary">Most Popular</span>
                      </div>
                    )}
                    <CardTitle className="text-2xl font-display">{plan.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1 min-h-[40px]">{plan.description}</p>
                  </CardHeader>

                  <CardContent className="flex-1 px-6 pb-6">
                    {/* Price */}
                    <div className="mb-6">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`${plan.id}-${interval}`}
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          transition={{ duration: 0.18 }}
                        >
                          <div className="flex items-end gap-1">
                            <span className="text-5xl font-bold text-foreground">${displayPrice}</span>
                            <span className="text-muted-foreground mb-1.5">/mo</span>
                          </div>
                          {interval === "year" && (
                            <p className="text-xs text-green-400 mt-1">
                              Billed ${displayPrice * 12}/year · Save ${(plan.monthlyPrice - plan.yearlyPrice) * 12}/yr
                            </p>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    {/* Features */}
                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-foreground/80">
                          <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlight ? "text-primary" : "text-green-500"}`} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter className="px-6 pb-6">
                    <Button
                      onClick={() => handleSubscribeClick(plan)}
                      disabled={checkoutLoading}
                      className={`w-full py-6 rounded-xl text-sm font-semibold transition-all ${
                        plan.highlight
                          ? "bg-gradient-to-r from-primary to-[#F09819] hover:opacity-90 text-white shadow-lg shadow-primary/25"
                          : "bg-white/10 hover:bg-white/20 text-white"
                      }`}
                    >
                      {isLoadingCard && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Get {plan.name}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

      </div>

      {/* Embedded Stripe checkout */}
      <AnimatePresence>
        {step === "checkout" && clientSecret && stripePromise && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
            >
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-black/10 hover:bg-black/20 text-black/60 hover:text-black transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={handleClose}
                className="absolute top-4 left-4 z-10 flex items-center gap-1 text-sm text-black/50 hover:text-black/80 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
