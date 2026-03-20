import { getStripeSync, getUncachableStripeClient } from "./stripeClient";

async function provisionOnActiveSubscription(customerId: string) {
  try {
    const stripe = await getUncachableStripeClient();
    const customer = await stripe.customers.retrieve(customerId);

    if (customer.deleted || !("email" in customer) || !customer.email) {
      console.log("[webhook] customer has no email, skipping provision");
      return;
    }

    const email = customer.email;
    const { db } = await import("@workspace/db");
    const { userAgentsTable } = await import("@workspace/db/schema");
    const { eq } = await import("drizzle-orm");
    const existing = await db
      .select()
      .from(userAgentsTable)
      .where(eq(userAgentsTable.userId, email))
      .limit(1);

    if (existing.length > 0) {
      console.log(`[webhook] agent already exists for ${email}`);
      return;
    }

    const agentName = `user-${email.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 32)}`;

    await db
      .insert(userAgentsTable)
      .values({
        userId: email,
        agentName,
        status: "active",
        instanceUrl: null,
      });

    console.log(`[webhook] provisioned agent record for ${email} (instanceUrl pending)`);
  } catch (err: any) {
    console.error("[webhook] provision error:", err.message);
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. " +
          "Received type: " +
          typeof payload +
          ". " +
          "This usually means express.json() parsed the body before reaching this handler. " +
          "FIX: Ensure webhook route is registered BEFORE app.use(express.json()).",
      );
    }

    try {
      const sync = await getStripeSync();
      await sync.processWebhook(payload, signature);
    } catch (err: any) {
      console.warn(
        "[webhook] stripe-replit-sync unavailable, continuing with direct Stripe handling:",
        err?.message || String(err),
      );
    }

    try {
      const stripe = await getUncachableStripeClient();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.warn("[webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification");
        return;
      }
      const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

      if (
        event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated"
      ) {
        const subscription = event.data.object as any;
        if (subscription.status === "active" || subscription.status === "trialing") {
          await provisionOnActiveSubscription(subscription.customer as string);
        }
      }
    } catch (err: any) {
      console.log("[webhook] post-process note:", err.message);
    }
  }
}
