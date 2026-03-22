FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json .npmrc ./
COPY artifacts ./artifacts
COPY lib ./lib

RUN pnpm install --frozen-lockfile

ARG VITE_CLERK_PUBLISHABLE_KEY=""
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}

RUN pnpm --filter @workspace/openclaw run build
RUN pnpm --filter @workspace/api-server run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && npm install -g openclaw@latest \
  && npm install -g github:NVIDIA/NemoClaw \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=builder /app/artifacts/openclaw/dist ./artifacts/openclaw/dist

EXPOSE 8080

CMD ["node", "artifacts/api-server/dist/index.mjs"]
