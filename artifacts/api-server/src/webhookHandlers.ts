import { getStripeSync, getUncachableStripeClient } from "./stripeClient";
import { isDbEnabled } from "./localDev";

const AFFILIATE_COMMISSION_RATE = Math.min(
  0.9,
  Math.max(0, Number(process.env.AFFILIATE_COMMISSION_RATE ?? "0.20")),
);

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

      if (event.type === "invoice.paid" && isDbEnabled()) {
        const invoice = event.data.object as any;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        const invoiceId = typeof invoice.id === "string" ? invoice.id : null;
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id ?? null;
        const amountPaid = Number(invoice.amount_paid ?? 0);
        const currency = String(invoice.currency || "usd").toLowerCase();

        if (customerId && invoiceId && amountPaid > 0) {
          try {
            const stripe = await getUncachableStripeClient();
            const customer = await stripe.customers.retrieve(customerId);
            const customerEmail =
              !customer.deleted && "email" in customer && customer.email
                ? customer.email.trim().toLowerCase()
                : null;

            if (customerEmail) {
              const { pool } = await import("@workspace/db");
              const attribution = await pool.query(
                `
                  SELECT affiliate_email, referred_email
                  FROM app.referral_attributions
                  WHERE stripe_customer_id = $1 OR referred_email = $2
                  ORDER BY created_at ASC
                  LIMIT 1
                `,
                [customerId, customerEmail],
              );

              const affiliateEmail = String(attribution.rows[0]?.affiliate_email || "").trim().toLowerCase();
              const referredEmail = String(attribution.rows[0]?.referred_email || customerEmail).trim().toLowerCase();
              if (affiliateEmail && affiliateEmail !== referredEmail) {
                const commissionCents = Math.floor(amountPaid * AFFILIATE_COMMISSION_RATE);
                if (commissionCents > 0) {
                  await pool.query(
                    `
                      INSERT INTO app.affiliate_commissions (
                        affiliate_email,
                        referred_email,
                        stripe_customer_id,
                        stripe_subscription_id,
                        stripe_invoice_id,
                        amount_cents,
                        currency,
                        status
                      )
                      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
                      ON CONFLICT (stripe_invoice_id) DO NOTHING
                    `,
                    [
                      affiliateEmail,
                      referredEmail,
                      customerId,
                      subscriptionId,
                      invoiceId,
                      commissionCents,
                      currency,
                    ],
                  );
                }
              }
            }
          } catch (err: any) {
            console.log("[webhook] affiliate commission note:", err?.message || err);
          }
        }
      }
    } catch (err: any) {
      console.log("[webhook] post-process note:", err.message);
    }
  }
}
