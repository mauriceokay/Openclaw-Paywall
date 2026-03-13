import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, X, ArrowLeft } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useListProducts, createCheckout } from "@workspace/api-client-react";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

export function Pricing() {
  const { data: productsData, isLoading, error } = useListProducts();

  const [step, setStep] = useState<"idle" | "email" | "checkout">("idle");
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleSubscribeClick = (priceId: string) => {
    setSelectedPriceId(priceId);
    setStep("email");
    setCheckoutError(null);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPriceId || !email) return;
    setEmailSubmitting(true);
    setCheckoutError(null);
    try {
      const mockUserId = `usr_${Math.random().toString(36).slice(2, 9)}`;
      const data = await createCheckout({ data: { priceId: selectedPriceId, userId: mockUserId, email } });
      setClientSecret(data.clientSecret);
      setStep("checkout");
    } catch (err: any) {
      setCheckoutError(err?.message || "Failed to start checkout. Please try again.");
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep("idle");
    setClientSecret(null);
    setSelectedPriceId(null);
    setCheckoutError(null);
  };

  const fetchClientSecret = useCallback(() => {
    return Promise.resolve(clientSecret!);
  }, [clientSecret]);

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.15 } },
  };
  const item = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
  };

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
                const isPremium = product.name.toLowerCase().includes("pro") || product.name.toLowerCase().includes("premium");

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
                          onClick={() => price ? handleSubscribeClick(price.id) : (window.location.href = "/dashboard")}
                          className={`w-full py-6 rounded-xl text-md font-semibold transition-all ${isPremium ? "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25" : "bg-white/10 hover:bg-white/20 text-white"}`}
                        >
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

      {/* Email capture dialog */}
      <Dialog open={step === "email"} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-3xl border-white/10">
          <form onSubmit={handleEmailSubmit}>
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-display">Enter your email</DialogTitle>
              <DialogDescription>
                We'll use this to create your Stripe account and manage your subscription.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mb-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-black/20 border-white/10"
                />
              </div>
              {checkoutError && (
                <p className="text-sm text-destructive">{checkoutError}</p>
              )}
            </div>
            <Button
              type="submit"
              disabled={emailSubmitting}
              className="w-full h-12 bg-gradient-to-r from-primary to-[#F09819] hover:opacity-90 text-white font-semibold rounded-xl"
            >
              {emailSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {emailSubmitting ? "Preparing checkout…" : "Continue to Payment"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Embedded Stripe checkout */}
      <AnimatePresence>
        {step === "checkout" && clientSecret && (
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
                onClick={() => setStep("email")}
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
