import { Router, type IRouter } from "express";
import { storage } from "../storage";
import { getUncachableStripeClient } from "../stripeClient";
import {
  CreateCheckoutResponse,
  CreatePortalSessionResponse,
  GetSubscriptionStatusResponse,
  ListProductsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/products", async (req, res) => {
  try {
    const rows = await storage.listProductsWithPrices();

    const productsMap = new Map<
      string,
      {
        id: string;
        name: string;
        description: string | null;
        prices: {
          id: string;
          unitAmount: number | null;
          currency: string;
          interval: string | null;
          intervalCount: number | null;
        }[];
      }
    >();

    for (const row of rows) {
      const r = row as any;
      if (!productsMap.has(r.product_id)) {
        productsMap.set(r.product_id, {
          id: r.product_id,
          name: r.product_name,
          description: r.product_description || null,
          prices: [],
        });
      }
      if (r.price_id) {
        const recurring = r.recurring as any;
        productsMap.get(r.product_id)!.prices.push({
          id: r.price_id,
          unitAmount: r.unit_amount ? Number(r.unit_amount) : null,
          currency: r.currency,
          interval: recurring?.interval || null,
          intervalCount: recurring?.interval_count || null,
        });
      }
    }

    const data = ListProductsResponse.parse({
      products: Array.from(productsMap.values()),
    });
    res.json(data);
  } catch (err) {
    console.error("Error listing products:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.get("/subscription/status", async (req, res) => {
  try {
    const email = req.query.email as string;
    if (!email) {
      const data = GetSubscriptionStatusResponse.parse({
        hasActiveSubscription: false,
      });
      return res.json(data);
    }

    const customer = await storage.getCustomerByEmail(email);
    if (!customer) {
      const data = GetSubscriptionStatusResponse.parse({
        hasActiveSubscription: false,
      });
      return res.json(data);
    }

    const sub = await storage.getSubscriptionByCustomerId((customer as any).id);
    if (!sub) {
      const data = GetSubscriptionStatusResponse.parse({
        hasActiveSubscription: false,
      });
      return res.json(data);
    }

    const s = sub as any;
    const items = s.items as any;
    let planName: string | null = null;
    try {
      const firstItem = Array.isArray(items?.data) ? items.data[0] : null;
      planName = firstItem?.plan?.nickname || firstItem?.price?.nickname || null;
    } catch {}

    const periodEnd = s.current_period_end
      ? new Date(Number(s.current_period_end) * 1000).toISOString()
      : null;

    const data = GetSubscriptionStatusResponse.parse({
      hasActiveSubscription: true,
      subscriptionId: s.id,
      planName,
      status: s.status,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: s.cancel_at_period_end,
    });
    res.json(data);
  } catch (err) {
    console.error("Error getting subscription status:", err);
    res.status(500).json({ error: "Failed to get subscription status" });
  }
});

router.post("/subscription/checkout", async (req, res) => {
  try {
    const { priceId, userId, email } = req.body;

    if (!priceId || !email) {
      return res.status(400).json({ error: "priceId and email are required" });
    }

    const stripe = await getUncachableStripeClient();

    let customerId: string;
    const existingCustomer = await storage.getCustomerByEmail(email);
    if (existingCustomer) {
      customerId = (existingCustomer as any).id;
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: { userId: userId || email },
      });
      customerId = customer.id;
    }

    const host =
      process.env.REPLIT_DOMAINS?.split(",")[0] || req.get("host") || "localhost";
    const baseUrl = `https://${host}`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${baseUrl}/dashboard?success=true`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
    });

    const data = CreateCheckoutResponse.parse({ url: session.url });
    res.json(data);
  } catch (err: any) {
    console.error("Error creating checkout:", err);
    res.status(400).json({ error: err.message || "Failed to create checkout" });
  }
});

router.post("/subscription/portal", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    const customer = await storage.getCustomerByEmail(email);
    if (!customer) {
      return res.status(400).json({ error: "No customer found for this email" });
    }

    const stripe = await getUncachableStripeClient();
    const host =
      process.env.REPLIT_DOMAINS?.split(",")[0] || req.get("host") || "localhost";
    const baseUrl = `https://${host}`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: (customer as any).id,
      return_url: `${baseUrl}/dashboard`,
    });

    const data = CreatePortalSessionResponse.parse({ url: portalSession.url });
    res.json(data);
  } catch (err: any) {
    console.error("Error creating portal:", err);
    res.status(400).json({ error: err.message || "Failed to create portal" });
  }
});

export default router;
