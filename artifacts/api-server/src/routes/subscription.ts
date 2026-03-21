import { Router, type IRouter, type Request, type Response } from "express";
import { storage } from "../storage";
import { getUncachableStripeClient } from "../stripeClient";
import { getSessionEmail } from "../sessionAuth";
import { activateLocalSubscription, getLocalSubscription, isDbEnabled } from "../localDev";
import { getUsageEventSummary } from "../usageTracking";
import { inferPlanTierFromSubscriptionItem, planTierToPlanName } from "../planTier";
import {
  CreateCheckoutResponse,
  CreatePortalSessionResponse,
  GetSubscriptionStatusResponse,
  ListProductsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const UNPAID_BLOCK_THRESHOLD_CENTS = 1500;

function sendBillingBlocked(res: Response) {
  res.setHeader("x-oc-billing-blocked", "1");
  return res.json(GetSubscriptionStatusResponse.parse({ hasActiveSubscription: false }));
}

async function isBlockedByOutstandingInvoices(customerId: string): Promise<boolean> {
  try {
    const stripe = await getUncachableStripeClient();
    const invoices = await stripe.invoices.list({ customer: customerId, limit: 25 });

    let outstandingCents = 0;
    for (const invoice of invoices.data) {
      if (invoice.status === "open" || invoice.status === "uncollectible") {
        outstandingCents += invoice.amount_remaining ?? 0;
      }
    }

    return outstandingCents >= UNPAID_BLOCK_THRESHOLD_CENTS;
  } catch {
    // Billing checks should never hard-fail subscription status.
    return false;
  }
}

function isHttpUrl(value: string | undefined | null): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function resolveAppBaseUrl(req: Request): string {
  if (isHttpUrl(process.env.APP_URL)) return process.env.APP_URL;

  // In production, never trust client-controlled Origin for checkout/portal return URLs.
  if (process.env.NODE_ENV === "production") {
    const host = req.get("host");
    if (host) {
      const proto = req.protocol === "https" ? "https" : "http";
      return `${proto}://${host}`;
    }
    return "http://localhost:3001";
  }

  const origin = req.get("origin");
  if (isHttpUrl(origin)) return origin;

  const host = req.get("host");
  if (host) {
    const proto = req.protocol === "https" ? "https" : "http";
    return `${proto}://${host}`;
  }

  return "http://localhost:3001";
}

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
    const sessionEmail = getSessionEmail(req);
    const email = sessionEmail || (req.query.email as string);
    const sessionId = req.query.sessionId as string | undefined;
    if (!email) {
      return res.json(GetSubscriptionStatusResponse.parse({ hasActiveSubscription: false }));
    }

    if (!isDbEnabled()) {
      const localSub = getLocalSubscription(email);
      if (localSub?.status === "active") {
        return res.json(
          GetSubscriptionStatusResponse.parse({
            hasActiveSubscription: true,
            subscriptionId: `local_${email}`,
            planName: localSub.planName,
            status: localSub.status,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
          }),
        );
      }

      try {
        const stripe = await getUncachableStripeClient();
        const customers = await stripe.customers.list({ email, limit: 1 });
        const customer = customers.data[0];

        if (customer) {
          const blocked = await isBlockedByOutstandingInvoices(customer.id);
          if (blocked) {
            return sendBillingBlocked(res);
          }
        }

        if (customer) {
          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            status: "all",
            limit: 10,
            expand: ["data.items.data.price.product"],
          });
          const sub = subscriptions.data.find((item) => item.status === "active" || item.status === "trialing");
          if (sub) {
            const firstItem = sub.items.data[0];
            const planName =
              firstItem?.plan?.nickname
              || firstItem?.price?.nickname
              || planTierToPlanName(inferPlanTierFromSubscriptionItem(firstItem))
              || null;
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
          }
        }

        if (sessionId) {
          const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ["subscription"],
          });
          const sessionCustomerEmail = checkoutSession.customer_details?.email || checkoutSession.customer_email;
          if (sessionCustomerEmail?.toLowerCase() === email.toLowerCase()) {
            const sub = typeof checkoutSession.subscription === "string"
              ? await stripe.subscriptions.retrieve(checkoutSession.subscription, {
                  expand: ["items.data.price.product"],
                })
              : checkoutSession.subscription;
            if (sub && (sub.status === "active" || sub.status === "trialing")) {
              const firstItem = sub.items.data[0];
              const planName =
                firstItem?.plan?.nickname
                || firstItem?.price?.nickname
                || planTierToPlanName(inferPlanTierFromSubscriptionItem(firstItem))
                || null;
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
            }
          }
        }
      } catch {
        // In local/no-db mode, missing Stripe keys should not block the app.
        // We just fall back to "no active subscription".
      }

      return res.json(GetSubscriptionStatusResponse.parse({ hasActiveSubscription: false }));
    }

    const customer = await storage.getCustomerByEmail(email);
    if (!customer) {
      return res.json(GetSubscriptionStatusResponse.parse({ hasActiveSubscription: false }));
    }

    const blocked = await isBlockedByOutstandingInvoices(customer.id);
    if (blocked) {
      return sendBillingBlocked(res);
    }

    const sub = await storage.getSubscriptionByCustomerId(customer.id);
    if (!sub) {
      return res.json(GetSubscriptionStatusResponse.parse({ hasActiveSubscription: false }));
    }

    let planName: string | null = null;
    try {
      const firstItem = Array.isArray(sub.items?.data) ? sub.items.data[0] : null;
      planName = firstItem?.plan?.nickname || firstItem?.price?.nickname || null;
      if (!planName) {
        planName = planTierToPlanName(inferPlanTierFromSubscriptionItem(firstItem));
      }
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

router.post("/subscription/local-activate", async (req, res) => {
  try {
    if (isDbEnabled()) {
      return res.status(400).json({ error: "Local activation is only available in no-db mode" });
    }

    const sessionEmail = getSessionEmail(req);
    if (!sessionEmail) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const email = sessionEmail.trim().toLowerCase();
    const planName = (req.body?.planName || "OpenClaw Pro").trim();

    const sub = activateLocalSubscription(email, planName);
    return res.json({ ok: true, status: sub.status, planName: sub.planName });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to activate local subscription" });
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
    if (!isDbEnabled()) {
      const existingCustomers = await stripe.customers.list({ email, limit: 1 });
      const existingCustomer = existingCustomers.data[0];
      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const customer = await stripe.customers.create({
          email,
          metadata: { userId: userId || email },
        });
        customerId = customer.id;
      }
    } else {
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
    }

    const baseUrl = resolveAppBaseUrl(req);
    const returnUrl = new URL("/setup", baseUrl);
    returnUrl.searchParams.set("success", "true");

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      ui_mode: "embedded",
      return_url: returnUrl.toString(),
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

    const stripe = await getUncachableStripeClient();
    let customerId: string | null = null;
    if (!isDbEnabled()) {
      const customers = await stripe.customers.list({ email, limit: 1 });
      customerId = customers.data[0]?.id ?? null;
    } else {
      const customer = await storage.getCustomerByEmail(email);
      customerId = customer?.id ?? null;
    }

    if (!customerId) {
      return res.status(400).json({ error: "No customer found for this email" });
    }

    const returnUrl = new URL("/dashboard", resolveAppBaseUrl(req)).toString();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return res.json(CreatePortalSessionResponse.parse({ url: portalSession.url }));
  } catch (err: any) {
    console.error("Error creating portal:", err);
    res.status(400).json({ error: err.message || "Failed to create portal" });
  }
});

// Fee multipliers per AI provider — Anthropic gets a 0.5x discount,
// all other providers (OpenAI, Gemini, etc.) get a 1.5x surcharge.
const PROVIDER_FEE_MULTIPLIERS: Record<string, number> = {
  anthropic: 0.5,
  openai: 1.5,
  gemini: 1.5,
  qwen: 1.5,
  moonshot: 1.5,
};
const BASE_RATE_PER_MESSAGE = 0.01; // USD per message before multiplier

router.get("/subscription/usage", async (req, res) => {
  try {
    const sessionEmail = getSessionEmail(req);
    if (!sessionEmail) return res.status(401).json({ error: "Authentication required" });
    const email = sessionEmail;
    const provider = (req.query.provider as string | undefined)?.toLowerCase() ?? "anthropic";
    const trackedEvents = await getUsageEventSummary(email);

    if (!isDbEnabled()) {
      return res.json({
        subscriptionId: null,
        planName: null,
        status: null,
        periodStart: null,
        periodEnd: null,
        currency: "usd",
        monthlyAmount: null,
        usageItems: [],
        trackedEvents,
        feeMultiplier: PROVIDER_FEE_MULTIPLIERS[provider] ?? 1.5,
        ratePerMessage: BASE_RATE_PER_MESSAGE * (PROVIDER_FEE_MULTIPLIERS[provider] ?? 1.5),
        provider,
      });
    }

    const customer = await storage.getCustomerByEmail(email);
    if (!customer) return res.status(404).json({ error: "No customer found" });

    const sub = await storage.getSubscriptionByCustomerId(customer.id);
    if (!sub) return res.status(404).json({ error: "No active subscription" });

    const stripe = await getUncachableStripeClient();

    const periodStart = sub.current_period_end
      ? new Date((Number(sub.current_period_end) - 30 * 24 * 60 * 60) * 1000).toISOString()
      : null;
    const periodEnd = sub.current_period_end
      ? new Date(Number(sub.current_period_end) * 1000).toISOString()
      : null;

    let planName: string | null = null;
    let unitAmount: number | null = null;
    let currency = "usd";
    let usageItems: Array<{ metric: string; totalUsage: number; unit: string }> = [];

    try {
      const fullSub = await stripe.subscriptions.retrieve(sub.id, {
        expand: ["items.data.price"],
      });

      const firstItem = fullSub.items.data[0];
      if (firstItem) {
        const price = firstItem.price as any;
        planName = price?.nickname || price?.product?.name || null;
        unitAmount = price?.unit_amount ?? null;
        currency = price?.currency ?? "usd";

        if (price?.recurring?.usage_type === "metered") {
          try {
            const summaries = await (stripe.subscriptionItems as any).listUsageRecordSummaries(
              firstItem.id,
              { limit: 1 }
            );
            const summary = summaries.data[0];
            if (summary) {
              usageItems.push({
                metric: "AI Messages",
                totalUsage: summary.total_usage,
                unit: "messages",
              });
            }
          } catch {}
        }
      }
    } catch {}

    if (planName === null) {
      try {
        const firstItem = Array.isArray(sub.items?.data) ? sub.items!.data[0] : null;
        planName = firstItem?.plan?.nickname || firstItem?.price?.nickname || null;
      } catch {}
    }

    const feeMultiplier = PROVIDER_FEE_MULTIPLIERS[provider] ?? 1.5;
    const ratePerMessage = BASE_RATE_PER_MESSAGE * feeMultiplier;

    return res.json({
      subscriptionId: sub.id,
      planName,
      status: sub.status,
      periodStart,
      periodEnd,
      currency,
      monthlyAmount: unitAmount ? unitAmount / 100 : null,
      usageItems,
      trackedEvents,
      feeMultiplier,
      ratePerMessage,
      provider,
    });
  } catch (err: any) {
    console.error("Error getting usage:", err);
    res.status(500).json({ error: "Failed to get usage data" });
  }
});

export default router;
