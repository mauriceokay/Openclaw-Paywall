import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, X, ArrowLeft } from "lucide-react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useListProducts, createCheckout } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";

export function Pricing() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { data: productsData, isLoading, error } = useListProducts();

  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [step, setStep] = useState<"idle" | "checkout">("idle");
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/signup");
      return;
    }
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg.stripePublishableKey) {
          setStripePromise(loadStripe(cfg.stripePublishableKey));
        }
      })
      .catch(() => {});
  }, [user, navigate]);

  // Synchronous render guard — returns null immediately so pricing content never flashes
  if (!user) return null;

  const handleSubscribeClick = async (priceId: string) => {
    if (!user) { navigate("/signup"); return; }
    setSelectedPriceId(priceId);
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
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
    setSelectedPriceId(null);
    setCheckoutError(null);
  };

  const fetchClientSecret = useCallback(() => Promise.resolve(clientSecret!), [clientSecret]);

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.15 } },
  };
  const item = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
  };

  if (!user) return null;

  return (
    <div className="min-h-screen pt-32 pb-24 bg-mesh">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-6 text-gradient">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-muted-foreground">
            Unlock the full potential of your personal AI assistant. Get premium features, priority routing, and unlimited automations.
          </p>
          {checkoutError && (
            <p className="mt-4 text-sm text-destructive">{checkoutError}</p>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
            <p>Loading plans...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <h3 className="text-xl font-bold mb-2">Failed to load plans</h3>
            <p className="text-muted-foreground">Please try refreshing the page.</p>
          </div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 justify-center max-w-5xl mx-auto"
          >
            {productsData?.products
              ?.filter((p) => p.name.toLowerCase().startsWith("openclaw"))
              .sort((a, b) => {
                const order = ["free", "pro", "team"];
                const ai = order.findIndex((k) => a.name.toLowerCase().includes(k));
                const bi = order.findIndex((k) => b.name.toLowerCase().includes(k));
                return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
              })
              .map((product) => {
                const price = product.prices.find((p) => p.interval === "month") ?? product.prices[0] ?? null;
                const formattedPrice = price?.unitAmount ? (price.unitAmount / 100).toFixed(2) : "0.00";
                const isPremium = product.name.toLowerCase().includes("pro");
                const isLoading = checkoutLoading && selectedPriceId === price?.id;

                return (
                  <motion.div key={product.id} variants={item} className="h-full">
                    <Card className={`h-full flex flex-col relative overflow-hidden bg-card/40 backdrop-blur-xl border-white/5 transition-all duration-300 hover:border-white/20 hover:shadow-2xl ${isPremium ? "ring-2 ring-primary border-transparent" : ""}`}>
                      {isPremium && (
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
                      )}
                      <CardHeader className="pb-8">
                        {isPremium && (
                          <div className="text-xs font-bold tracking-wider uppercase text-primary mb-2">Most Popular</div>
                        )}
                        <CardTitle className="text-2xl font-display">{product.name}</CardTitle>
                        <CardDescription className="text-muted-foreground min-h-[40px]">
                          {product.description || "The perfect plan to get started with OpenClaw."}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="flex-1 pb-8">
                        <div className="mb-8">
                          <span className="text-4xl font-bold text-foreground">${formattedPrice}</span>
                          <span className="text-muted-foreground">/{price?.interval || "month"}</span>
                        </div>
                        <ul className="space-y-4">
                          {["All 20+ Channel Integrations", "Unlimited Voice/Talk Usage", "Advanced Automations (Cron/Webhooks)", "Priority Model Routing"].map((feature, i) => (
                            <li key={i} className="flex items-start gap-3 text-sm text-foreground/80">
                              <Check className="w-5 h-5 text-primary shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>

                      <CardFooter>
                        <Button
                          onClick={() => price ? handleSubscribeClick(price.id) : navigate("/dashboard")}
                          disabled={checkoutLoading}
                          className={`w-full py-6 rounded-xl text-md font-semibold transition-all ${isPremium ? "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25" : "bg-white/10 hover:bg-white/20 text-white"}`}
                        >
                          {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          {price ? `Subscribe to ${product.name}` : "Get Started Free"}
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                );
              })}
          </motion.div>
        )}
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

              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{ fetchClientSecret }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
