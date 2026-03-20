# Hetzner Deployment

This deploy target runs:
- OpenClaw Paywall app + API
- OpenClaw Gateway
- Mission Control (frontend + backend + worker)
- PostgreSQL (app + mission control) and Redis
- Caddy for HTTPS

## 1. Server prep

On your Hetzner Ubuntu server:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

## 2. Clone and configure

```bash
git clone https://github.com/mauriceokay/Openclaw-Paywall.git
cd Openclaw-Paywall/deploy/hetzner
cp .env.example .env
```

Edit `.env` and set real values:
- `DOMAIN` and `APP_URL`
- DB passwords
- `SESSION_SECRET`
- Stripe live keys
- `STRIPE_WEBHOOK_SECRET`
- Clerk publishable key

## 3. DNS

Create an `A` record:
- `DOMAIN` -> your Hetzner server public IPv4

Wait until DNS resolves.

## 4. Start stack

```bash
docker compose --env-file .env up -d --build
```

## 5. Verify

```bash
docker compose ps
docker compose logs -f app
```

Open `https://<DOMAIN>`.

## 6. Stripe webhook

In Stripe dashboard, add webhook endpoint:
- `https://<DOMAIN>/api/stripe/webhook`

Then set webhook secret in your runtime if you use strict webhook signature checks in your Stripe setup flow.
For this stack, set `STRIPE_WEBHOOK_SECRET` in `deploy/hetzner/.env`.

## Update deployment

```bash
cd Openclaw-Paywall
git pull
cd deploy/hetzner
docker compose --env-file .env up -d --build
```

## Deploy via API webhook

This stack now includes a protected webhook endpoint:
- `POST https://<DOMAIN>/api/deploy`

### Configure

In `deploy/hetzner/.env`, set:
- `DEPLOY_WEBHOOK_SECRET` to a long random string
- optional: `DEPLOY_GIT_REMOTE` (default `origin`)
- optional: `DEPLOY_GIT_BRANCH` (default `master`)

Then rebuild once:

```bash
cd Openclaw-Paywall/deploy/hetzner
docker compose --env-file .env up -d --build
```

### Trigger update

```bash
curl -X POST "https://<DOMAIN>/api/deploy" \
  -H "X-Deploy-Token: <DEPLOY_WEBHOOK_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"ref":"refs/heads/master"}'
```

If token is valid, the webhook runs:
1. `git pull origin master`
2. `docker compose --env-file .env up -d --build --remove-orphans`
