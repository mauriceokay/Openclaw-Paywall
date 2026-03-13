import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

export async function getUncachableStripeClient(): Promise<Stripe> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set.");
  }
  return new Stripe(secretKey);
}

let stripeSyncInstance: StripeSync | null = null;

export async function getStripeSync(): Promise<StripeSync> {
  if (!stripeSyncInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set.");
    }
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required");
    }
    stripeSyncInstance = new StripeSync({ stripeSecretKey: secretKey, databaseUrl });
  }
  return stripeSyncInstance;
}
