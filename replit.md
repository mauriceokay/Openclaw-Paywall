# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Hosts the OpenClaw marketing/paywall web app plus the OpenClaw gateway running as a background service.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Payments**: Stripe (via stripe + stripe-replit-sync)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (subscriptions, Stripe, products)
│   └── openclaw/           # React + Vite marketing + paywall web app
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (seed-products, etc.)
├── openclaw-app/           # OpenClaw gateway (npm package, pre-built)
└── openclaw-src/           # OpenClaw source code (from GitHub, for reference)
```

## Workflows

- `artifacts/openclaw: web` — React frontend on port 20581 (preview path `/`)
- `artifacts/api-server: API Server` — Express API on port 8080 (prefix `/api`)
- `OpenClaw Gateway` — OpenClaw WebSocket gateway on port 3001 (foreground mode)

## Stripe Integration

- Stripe was NOT connected via the Replit integration (user dismissed it).
- The user provided a publishable key: `pk_test_51T92YY...`
- **TODO**: Store `STRIPE_SECRET_KEY` as a secret for the Stripe integration to work.
- Once the secret key is stored, run: `pnpm --filter @workspace/scripts run seed-products` to create products in Stripe.
- After products are created, the paywall on the pricing page will show real plans.

## OpenClaw Gateway

The OpenClaw gateway (https://github.com/openclaw/openclaw) is installed at `openclaw-app/` via npm (`openclaw@2026.3.12`).

- **Running**: `openclaw gateway run --allow-unconfigured --port 3001 --dev`
- **Configure**: Run `./node_modules/.bin/openclaw configure` in `openclaw-app/` to set up AI provider + channels
- **Onboard**: Run `./node_modules/.bin/openclaw onboard` for the interactive wizard

## API Routes

- `GET /api/healthz` — Health check
- `GET /api/products` — List subscription plans from Stripe
- `GET /api/subscription/status?email=<email>` — Check subscription status
- `POST /api/subscription/checkout` — Create Stripe checkout session `{ priceId, userId, email }`
- `POST /api/subscription/portal` — Create Stripe billing portal session `{ email }`
- `POST /api/stripe/webhook` — Stripe webhook (registered before express.json())

## Seeds

Run after connecting Stripe:
```bash
pnpm --filter @workspace/scripts run seed-products
```
