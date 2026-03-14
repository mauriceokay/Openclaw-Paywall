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

router.get("/products", async (_req, res) => {
  try {
    const stripe = await getUncachableStripeClient();

    const [productsRes, pricesRes] = await Promise.all([
      stripe.products.list({ active: true, limit: 20 }),
      stripe.prices.list({ active: true, limit: 100 }),
    ]);

    const pricesByProduct = new Map<string, typeof pricesRes.data>();
    for (const price of pricesRes.data) {
      const productId = typeof price.product === "string" ? price.product : price.product.id;
      if (!pricesByProduct.has(productId)) pricesByProduct.set(productId, []);
      pricesByProduct.get(productId)!.push(price);
    }

    const products = productsRes.data.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description ?? null,
      prices: (pricesByProduct.get(product.id) ?? []).map((price) => ({
        id: price.id,
        unitAmount: price.unit_amount ?? null,
        currency: price.currency,
        interval: price.recurring?.interval ?? null,
        intervalCount: price.recurring?.interval_count ?? null,
      })),
    }));

    const data = ListProductsResponse.parse({ products });
    res.json(data);
  } catch (err: any) {
    console.error("Error listing products:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.get("/subscription/status", async (req, res) => {
  try {
    const email = req.query.email as string;
    if (!email) {
      return res.json(GetSubscriptionStatusResponse.parse({ hasActiveSubscription: false }));
    }

    const customer = await storage.getCustomerByEmail(email);
    if (!customer) {
      return res.json(GetSubscriptionStatusResponse.parse({ hasActiveSubscription: false }));
    }

    const sub = await storage.getSubscriptionByCustomerId(customer.id);
    if (!sub) {
      return res.json(GetSubscriptionStatusResponse.parse({ hasActiveSubscription: false }));
    }

    let planName: string | null = null;
    try {
      const firstItem = Array.isArray(sub.items?.data) ? sub.items.data[0] : null;
      planName = firstItem?.plan?.nickname || firstItem?.price?.nickname || null;
    } catch {}

    const periodEnd = sub.current_period_end
      ? new Date(Number(sub.current_period_end) * 1000).toISOString()
      : null;

    return res.json(
      GetSubscriptionStatusResponse.parse({
        hasActiveSubscription: true,
        subscriptionId: sub.id,
        planName,
        status: sub.status,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      }),
    );
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
      customerId = existingCustomer.id;
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: { userId: userId || email },
      });
      customerId = customer.id;
    }

    const host = process.env.REPLIT_DOMAINS?.split(",")[0] || req.get("host") || "localhost";
    const baseUrl = `https://${host}`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      ui_mode: "embedded",
      return_url: `${baseUrl}/setup?success=true&session_id={CHECKOUT_SESSION_ID}`,
    });

    return res.json(CreateCheckoutResponse.parse({ clientSecret: session.client_secret }));
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
    const host = process.env.REPLIT_DOMAINS?.split(",")[0] || req.get("host") || "localhost";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `https://${host}/dashboard`,
    });

    return res.json(CreatePortalSessionResponse.parse({ url: portalSession.url }));
  } catch (err: any) {
    console.error("Error creating portal:", err);
    res.status(400).json({ error: err.message || "Failed to create portal" });
  }
});

export default router;
