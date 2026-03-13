import { getUncachableStripeClient } from "./stripeClient";

async function createProducts() {
  try {
    const stripe = await getUncachableStripeClient();

    console.log("Creating OpenClaw subscription plans in Stripe...");

    const existingFree = await stripe.products.search({
      query: "name:'OpenClaw Free' AND active:'true'",
    });

    if (existingFree.data.length === 0) {
      const freeProduct = await stripe.products.create({
        name: "OpenClaw Free",
        description: "Get started with OpenClaw — self-hosted personal AI assistant",
        metadata: {
          tier: "free",
          features: JSON.stringify([
            "1 messaging channel",
            "Basic AI models",
            "Community support",
            "Self-hosted",
          ]),
        },
      });
      console.log(`Created Free product: ${freeProduct.id}`);
    } else {
      console.log("OpenClaw Free already exists — skipping");
    }

    const existingPro = await stripe.products.search({
      query: "name:'OpenClaw Pro' AND active:'true'",
    });

    if (existingPro.data.length === 0) {
      const proProduct = await stripe.products.create({
        name: "OpenClaw Pro",
        description: "Unlimited channels, advanced AI models, priority support",
        metadata: {
          tier: "pro",
          features: JSON.stringify([
            "Unlimited messaging channels",
            "All AI models (GPT-4, Claude, Gemini)",
            "Voice & Talk Mode",
            "Browser automation",
            "Canvas & nodes",
            "Priority support",
            "Self-hosted",
          ]),
        },
      });
      console.log(`Created Pro product: ${proProduct.id}`);

      await stripe.prices.create({
        product: proProduct.id,
        unit_amount: 1200,
        currency: "usd",
        recurring: { interval: "month" },
        nickname: "Pro Monthly",
      });
      console.log("Created Pro monthly price: $12/month");

      await stripe.prices.create({
        product: proProduct.id,
        unit_amount: 9900,
        currency: "usd",
        recurring: { interval: "year" },
        nickname: "Pro Yearly",
      });
      console.log("Created Pro yearly price: $99/year");
    } else {
      console.log("OpenClaw Pro already exists — skipping");
    }

    const existingTeam = await stripe.products.search({
      query: "name:'OpenClaw Team' AND active:'true'",
    });

    if (existingTeam.data.length === 0) {
      const teamProduct = await stripe.products.create({
        name: "OpenClaw Team",
        description: "Everything in Pro, plus multi-user support and team management",
        metadata: {
          tier: "team",
          features: JSON.stringify([
            "Everything in Pro",
            "Up to 10 team members",
            "Shared workspaces",
            "Admin controls",
            "SSO / SAML",
            "Dedicated support",
            "Self-hosted",
          ]),
        },
      });
      console.log(`Created Team product: ${teamProduct.id}`);

      await stripe.prices.create({
        product: teamProduct.id,
        unit_amount: 4900,
        currency: "usd",
        recurring: { interval: "month" },
        nickname: "Team Monthly",
      });
      console.log("Created Team monthly price: $49/month");

      await stripe.prices.create({
        product: teamProduct.id,
        unit_amount: 39900,
        currency: "usd",
        recurring: { interval: "year" },
        nickname: "Team Yearly",
      });
      console.log("Created Team yearly price: $399/year");
    } else {
      console.log("OpenClaw Team already exists — skipping");
    }

    console.log("\n✓ All products and prices created successfully!");
    console.log("Webhooks will sync this data to your database automatically.");
  } catch (error: any) {
    console.error("Error creating products:", error.message);
    process.exit(1);
  }
}

createProducts();
