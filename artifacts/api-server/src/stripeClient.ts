import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

type TokenResponse = {
  access_token: string;
  publishable_key: string;
  expires_at: number;
};

async function fetchStripeTokens(): Promise<TokenResponse> {
  const connectorHostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const replIdentity = process.env.REPL_IDENTITY;

  if (!connectorHostname || !replIdentity) {
    throw new Error(
      "Missing Replit connector environment variables. Make sure the Stripe integration is connected.",
    );
  }

  const response = await fetch(
    `https://${connectorHostname}/api/v1/connectors/stripe/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${replIdentity}`,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch Stripe token: ${response.status} ${errorText}`,
    );
  }

  return response.json();
}

let cachedTokens: TokenResponse | null = null;

export async function getUncachableStripeClient(): Promise<Stripe> {
  if (cachedTokens && Date.now() / 1000 < cachedTokens.expires_at - 60) {
    return new Stripe(cachedTokens.access_token);
  }

  cachedTokens = await fetchStripeTokens();
  return new Stripe(cachedTokens.access_token);
}

let stripeSyncInstance: StripeSync | null = null;

export async function getStripeSync(): Promise<StripeSync> {
  if (!stripeSyncInstance) {
    const stripe = await getUncachableStripeClient();
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required");
    }
    stripeSyncInstance = new StripeSync({ stripe, databaseUrl });
  }
  return stripeSyncInstance;
}
