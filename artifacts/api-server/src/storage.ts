import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export class Storage {
  async listProductsWithPrices(active = true) {
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

  async getSubscriptionByCustomerId(customerId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE customer = ${customerId} AND status IN ('active', 'trialing') ORDER BY created DESC LIMIT 1`,
    );
    return result.rows[0] || null;
  }

  async getSubscription(subscriptionId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`,
    );
    return result.rows[0] || null;
  }

  async getCustomerByEmail(email: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.customers WHERE email = ${email} AND deleted IS NOT TRUE LIMIT 1`,
    );
    return result.rows[0] || null;
  }
}

export const storage = new Storage();
