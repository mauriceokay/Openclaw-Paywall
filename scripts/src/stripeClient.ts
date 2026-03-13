import Stripe from "stripe";

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

export async function getUncachableStripeClient(): Promise<Stripe> {
  const tokens = await fetchStripeTokens();
  return new Stripe(tokens.access_token);
}
