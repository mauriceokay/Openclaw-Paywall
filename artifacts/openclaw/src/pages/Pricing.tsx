import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useListProducts, useCreateCheckout } from "@workspace/api-client-react";

export function Pricing() {
  const { data: productsData, isLoading, error } = useListProducts();
  const checkoutMutation = useCreateCheckout();
  
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubscribeClick = (priceId: string) => {
    setSelectedPriceId(priceId);
    setIsDialogOpen(true);
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPriceId || !email) return;

    // Simulated user ID since there is no actual auth system
    const mockUserId = `usr_${Math.random().toString(36).slice(2, 9)}`;

    checkoutMutation.mutate({
      data: {
        priceId: selectedPriceId,
        userId: mockUserId,
        email: email
      }
    }, {
      onSuccess: (data) => {
        // Redirect to Stripe checkout URL
        window.location.href = data.url;
      }
    });
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
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
            <div className="inline-block p-4 rounded-full bg-destructive/10 text-destructive mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Failed to load plans</h3>
            <p className="text-muted-foreground">Please try refreshing the page later.</p>
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
                  <Card className={`h-full flex flex-col relative overflow-hidden bg-card/40 backdrop-blur-xl border-white/5 transition-all duration-300 hover:border-white/20 hover:shadow-2xl ${isPremium ? 'ring-2 ring-primary border-transparent' : ''}`}>
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
                        <span className="text-muted-foreground">/{price?.interval || 'month'}</span>
                      </div>
                      
                      <ul className="space-y-4">
                        {/* Mocking features since API only returns basic product info */}
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
                        onClick={() => price ? handleSubscribeClick(price.id) : window.location.href = '/dashboard'}
                        className={`w-full py-6 rounded-xl text-md font-semibold transition-all ${
                          isPremium 
                            ? 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25' 
                            : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
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

      {/* Checkout Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-3xl border-white/10">
          <form onSubmit={handleCheckoutSubmit}>
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-display">Complete your subscription</DialogTitle>
              <DialogDescription>
                Enter your email address below to proceed to the secure checkout page.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 mb-8">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="you@example.com" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background/50 border-white/10 focus-visible:ring-primary h-12"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsDialogOpen(false)}
                className="hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={checkoutMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                {checkoutMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Proceeding...</>
                ) : (
                  "Continue to Checkout"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
