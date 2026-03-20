import { sql } from "drizzle-orm";

export interface StripeCustomerRow {
  id: string;
  email: string;
  deleted?: boolean;
}

export interface StripeSubscriptionRow {
  id: string;
  customer: string;
  status: string;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  items?: { data?: Array<{ plan?: { nickname?: string }; price?: { nickname?: string } }> };
}

export class Storage {
  async listProductsWithPrices(active = true) {
    const { db } = await import("@workspace/db");
    const result = await db.execute(
      sql`
        WITH paginated_products AS (
          SELECT id, name, description, metadata, active
          FROM stripe.products
          WHERE active = ${active}
          ORDER BY name
        )
        SELECT 
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.active as product_active,
          p.metadata as product_metadata,
          pr.id as price_id,
          pr.unit_amount,
          pr.currency,
          pr.recurring,
          pr.active as price_active
        FROM paginated_products p
        LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        ORDER BY p.name, pr.unit_amount
      `,
    );
    return result.rows;
  }

  async getSubscriptionByCustomerId(customerId: string): Promise<StripeSubscriptionRow | null> {
    try {
      const { db } = await import("@workspace/db");
      const result = await db.execute(
        sql`SELECT * FROM stripe.subscriptions WHERE customer = ${customerId} AND status IN ('active', 'trialing') ORDER BY created DESC LIMIT 1`,
      );
      return (result.rows[0] as StripeSubscriptionRow) || null;
    } catch (err) {
      try {
        const { getUncachableStripeClient } = await import("./stripeClient");
        const stripe = await getUncachableStripeClient();
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 10,
        });
        const sub = subscriptions.data.find((item) => item.status === "active" || item.status === "trialing");
        return (sub as unknown as StripeSubscriptionRow) ?? null;
      } catch {
        return null;
      }
    }
  }

  async getSubscription(subscriptionId: string): Promise<StripeSubscriptionRow | null> {
    try {
      const { db } = await import("@workspace/db");
      const result = await db.execute(
        sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`,
      );
      return (result.rows[0] as StripeSubscriptionRow) || null;
    } catch (err) {
      try {
        const { getUncachableStripeClient } = await import("./stripeClient");
        const stripe = await getUncachableStripeClient();
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        return (sub as unknown as StripeSubscriptionRow) ?? null;
      } catch {
        return null;
      }
    }
  }

  async getCustomerByEmail(email: string): Promise<StripeCustomerRow | null> {
    try {
      const { db } = await import("@workspace/db");
      const result = await db.execute(
        sql`SELECT * FROM stripe.customers WHERE email = ${email} AND deleted IS NOT TRUE LIMIT 1`,
      );
      return (result.rows[0] as StripeCustomerRow) || null;
    } catch (err) {
      try {
        const { getUncachableStripeClient } = await import("./stripeClient");
        const stripe = await getUncachableStripeClient();
        const customers = await stripe.customers.list({ email, limit: 1 });
        const customer = customers.data[0];
        if (!customer) return null;
        return {
          id: customer.id,
          email: customer.email ?? email,
          deleted: (customer as { deleted?: boolean }).deleted,
        };
      } catch {
        return null;
      }
    }
  }
}

export const storage = new Storage();
