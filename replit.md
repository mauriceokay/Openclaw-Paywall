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

## OpenClaw Architecture

The OpenClaw gateway (https://github.com/openclaw/openclaw) v2026.3.12 is installed at `openclaw-app/` via npm.

### Gateway Proxy
The API server proxies the real OpenClaw control UI through `/api/gateway/*`:
- **HTTP proxy**: `app.ts` uses `http-proxy-middleware` with `responseInterceptor` to:
  - Strip `X-Frame-Options: DENY` (allows iframe embedding)
  - Remove `frame-ancestors: none` from CSP
  - Inject `window.__OPENCLAW_CONTROL_UI_BASE_PATH__ = "/api/gateway"` into HTML
- **WebSocket proxy**: `index.ts` intercepts WS upgrades at `/api/gateway` and proxies to `ws://127.0.0.1:3001`

### AI Provider
OpenClaw uses the Replit AI Integration for Anthropic (Claude):
- `ANTHROPIC_API_KEY` = `$AI_INTEGRATIONS_ANTHROPIC_API_KEY` (set in `start-gateway.sh`)
- `ANTHROPIC_BASE_URL` = `$AI_INTEGRATIONS_ANTHROPIC_BASE_URL` (set in `start-gateway.sh`)
- Model: `anthropic/claude-opus-4-6` (configured by OpenClaw)

### Per-User Agent Provisioning
Each subscriber gets their own OpenClaw agent workspace:
- `POST /api/openclaw/provision` — calls `openclaw agents add --non-interactive --workspace <dir>`
- `GET /api/openclaw/agent?email=<email>` — get user's agent info
- Stored in `user_agents` PostgreSQL table
- Workspaces at `~/.openclaw/workspaces/user-<sanitized-email>/`

### User Flow
1. User subscribes via Stripe checkout
2. User clicks "Open OpenClaw" on Dashboard
3. App provisions their OpenClaw agent workspace (first time only)
4. Real OpenClaw control UI loads in full-screen iframe (proxied via `/api/gateway/`)
5. User can configure channels (Telegram, Discord, WhatsApp), set up skills, chat with AI

## API Routes

- `GET /api/healthz` — Health check
- `GET /api/products` — List subscription plans from Stripe
- `GET /api/subscription/status?email=<email>` — Check subscription status
- `POST /api/subscription/checkout` — Create Stripe checkout session `{ priceId, userId, email }`
- `POST /api/subscription/portal` — Create Stripe billing portal session `{ email }`
- `POST /api/stripe/webhook` — Stripe webhook (registered before express.json())
- `POST /api/openclaw/provision` — Provision per-user OpenClaw agent `{ userId, email }`
- `GET /api/openclaw/agent?email=<email>` — Get user's agent info
- `GET /api/openclaw/agents` — List all provisioned agents
- `GET /api/gateway/*` — Proxied OpenClaw control UI (HTTP)
- `WS /api/gateway` — Proxied OpenClaw gateway WebSocket

## Database Tables

- `app.users` — `id TEXT PK DEFAULT gen_random_uuid()`, `name TEXT`, `email TEXT UNIQUE`, `created_at TIMESTAMPTZ`
- `app.conversations` — Anthropic chat conversation history
- `app.messages` — Anthropic chat messages
- `app.user_agents` — Per-user OpenClaw agent provisioning info

## Internationalization (i18n)

The OpenClaw frontend supports 8 languages with full translation coverage across all pages.

### Architecture
- **Custom typed context** — No react-i18next. Uses `LanguageProvider` (in `src/context/LanguageContext.tsx`) wrapping the entire app.
- **Hook**: `useLanguage()` → `{ t, locale, setLocale, dir }` where `t` is a fully typed `Locale` object.
- **Locale detection**: localStorage key `openclaw-language` → `navigator.language` → `"en"` fallback.
- **RTL**: Arabic (`ar`) sets `document.documentElement.dir = "rtl"` automatically via `useEffect`.

### Supported Languages
`en` · `de` · `fr` · `zh-CN` · `zh-TW` · `ja` · `ar` (RTL) · `pl`

### File Structure
```
src/i18n/
  index.ts              # detectLocale, saveLocale, SUPPORTED_LANGUAGES, LocaleCode type
  locales/
    en.ts               # Source of truth (Locale type derived from this)
    de.ts / fr.ts / zh-CN.ts / zh-TW.ts / ja.ts / ar.ts / pl.ts

src/context/
  LanguageContext.tsx   # LanguageProvider + useLanguage hook

src/components/
  LanguageSwitcher.tsx  # Flag + label dropdown in Navbar

src/data/
  blog-index.ts         # getBlogPostsForLocale / getBlogPostForLocale / getRelatedPostsForLocale
  blog-translations/
    de.ts / fr.ts / zh-CN.ts / zh-TW.ts / ja.ts / ar.ts / pl.ts
```

### Translated Sections
- Navbar, Footer, LanguageSwitcher
- `Home.tsx`: badge, hero, features, why section (pains/wins), testimonials headings, final CTA
- `Blog.tsx`: title, description, featured label, read labels, topics
- `BlogPost.tsx`: breadcrumb, CTA banner, related posts heading, FAQ heading, callout button

## Seeds

Run after connecting Stripe:
```bash
pnpm --filter @workspace/scripts run seed-products
```
