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
- **Build**: esbuild (ESM bundle)
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
├── openclaw-src/           # OpenClaw source code (from GitHub, for reference)
└── mission-control/        # OpenClaw Mission Control (cloned from abhi1693/openclaw-mission-control)
    ├── backend/            # FastAPI backend (port 8001)
    └── frontend/           # Next.js frontend (port 3002, basePath=/mission-control)
```

## Workflows

- `artifacts/openclaw: web` — React frontend on port 20581 (preview path `/`)
- `artifacts/api-server: API Server` — Express API on port 8080 (prefix `/api`)
- `OpenClaw Gateway` — OpenClaw WebSocket gateway on port 3001 (foreground mode)
- `Mission Control: Backend` — FastAPI on port 8001 (proxied at `/mc-api`)
- `Mission Control: Frontend` — Next.js on port 3002 (proxied at `/mission-control`)

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

### Per-User Cloud Instance Routing
Each subscriber gets their own dedicated cloud OpenClaw instance:
- `POST /api/openclaw/provision` — creates a DB record for the user; accepts optional `instanceUrl` (validated HTTPS, no internal hosts)
- `GET /api/openclaw/instance?userId=<email>` — returns user's instance URL and readiness status
- `GET /api/openclaw/agent?email=<email>` — get user's agent info
- `GET /api/instance-proxy/*` — per-user dynamic proxy to the user's cloud instance (cookie-based session after initial `?userId=` request)
- Stored in `user_agents` PostgreSQL table with `instance_url` column
- Instance URL validation: must be HTTPS, blocks private/internal IPs and hostnames (SSRF protection in `instanceUrlValidator.ts`)
- Webhook auto-provisioning: Stripe `customer.subscription.created`/`updated` with `status: active` creates a pending user_agents record

### User Flow
1. User subscribes via Stripe checkout
2. Stripe webhook creates pending user_agents record (no instanceUrl yet)
3. User clicks "Open OpenClaw" on Dashboard
4. If `instanceUrl` is set → loads cloud instance via per-user proxy in full-screen iframe
5. If `instanceUrl` is null → shows "Your instance is being set up" with auto-polling every 30s
6. Infrastructure sets the `instanceUrl` via `POST /api/openclaw/provision` when the cloud instance is ready

## Mission Control Integration

OpenClaw Mission Control (abhi1693/openclaw-mission-control) is an AI agent orchestration dashboard integrated into the app.

### Architecture
- **Backend**: FastAPI (Python 3.12) on port 8001, uses the same PostgreSQL database
- **Frontend**: Next.js 16 on port 3002 (pinned) with `basePath: "/mission-control"`
- **Auth**: `AUTH_MODE=local` with shared `LOCAL_AUTH_TOKEN` (64-char hex, stored as `MISSION_CONTROL_TOKEN` env var)
- **DB**: `DB_AUTO_MIGRATE=true` runs Alembic migrations on startup

### Required Secret
- `MISSION_CONTROL_TOKEN` — Replit Secret, must be 50+ characters (hex recommended). Used as `LOCAL_AUTH_TOKEN` for the FastAPI backend. The frontend prompts for this token on the login page.

### Environment Contract (workflow-injected)
The backend workflow command injects these from the Replit runtime:
- `DATABASE_URL` — constructed from `PGUSER`, `PGPASSWORD`, `PGHOST`, `PGPORT`, `PGDATABASE` (psycopg format)
- `CORS_ORIGINS` — derived from `REPLIT_DOMAINS` (fallback `REPLIT_DEV_DOMAIN`)
- `BASE_URL` — derived from `REPLIT_DOMAINS` (fallback `REPLIT_DEV_DOMAIN`) + `/mc-api`
- `LOCAL_AUTH_TOKEN` — from `MISSION_CONTROL_TOKEN` Replit Secret

### Proxy Chain (dev mode)
1. Browser → Vite dev server (port 20581) — Vite proxy config forwards `/mission-control` and `/mc-api` to API server
2. Vite → API server (port 8080) — Express proxies:
   - `/mission-control/**` → Next.js on port 3002 (pathRewrite prepends `/mission-control`)
   - `/mc-api/**` → FastAPI on port 8001
3. SPA catch-all explicitly excludes `/mission-control` and `/mc-api` paths

### Dashboard Access
- "Mission Control" card in Dashboard.tsx opens `/mission-control` in a new tab (visible to subscribed users)

## API Routes

- `GET /api/healthz` — Health check
- `GET /api/products` — List subscription plans from Stripe
- `GET /api/subscription/status?email=<email>` — Check subscription status
- `POST /api/subscription/checkout` — Create Stripe checkout session `{ priceId, userId, email }`
- `POST /api/subscription/portal` — Create Stripe billing portal session `{ email }`
- `POST /api/stripe/webhook` — Stripe webhook (registered before express.json())
- `POST /api/openclaw/provision` — Provision per-user agent record `{ userId, email, instanceUrl? }`
- `GET /api/openclaw/instance?userId=<email>` — Get user's instance URL and readiness
- `GET /api/openclaw/agent?email=<email>` — Get user's agent info
- `GET /api/openclaw/agents` — List all provisioned agents
- `GET /api/instance-proxy/*?userId=<email>` — Per-user dynamic proxy to cloud instance (sets cookie for subsequent requests)
- `GET /api/gateway/*` — Proxied local OpenClaw control UI (HTTP, fallback/demo)
- `WS /api/gateway` — Proxied local OpenClaw gateway WebSocket (fallback/demo)
- `WS /api/instance-proxy` — Per-user WebSocket proxy to cloud instance

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
`en` · `de` · `fr` · `zh-CN` · `zh-TW` · `ja` · `ar` (RTL) · `pl` · `ko` · `ms`

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

## Railway Deployment

The entire app can be deployed on Railway as a single service + Railway PostgreSQL.

### Config
- `railway.toml` — build/deploy config at repo root
- Build: `pnpm run build:railway` (builds frontend → api-server bundle)
- Start: `node artifacts/api-server/dist/index.mjs`
- Health: `/health` endpoint
- DB: Auto-migrates on startup (CREATE TABLE IF NOT EXISTS)
- Static: api-server serves frontend build from `artifacts/openclaw/dist/public/`

### Required Environment Variables
- `DATABASE_URL` — Railway PostgreSQL connection string
- `APP_URL` — Full app URL (e.g. `https://your-app.railway.app`) for Stripe webhooks/redirects
- `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` — Stripe keys
- `SESSION_SECRET` — Random 64-char hex for HMAC session cookies
- `PORT` — Auto-set by Railway
- `NODE_ENV=production`

See `.env.example` for reference.

### What APP_URL replaces
Three places previously used `REPLIT_DOMAINS` for URL construction:
1. Stripe webhook registration in `index.ts`
2. Checkout return URL in `subscription.ts`
3. Billing portal return URL in `subscription.ts`

All now use `APP_URL` with fallback to `REPLIT_DOMAINS` then `req.get("host")`.

## Seeds

Run after connecting Stripe:
```bash
pnpm --filter @workspace/scripts run seed-products
```
