# syntax=docker/dockerfile:1

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ARG NEXT_PUBLIC_AUTH_MODE
ENV NEXT_PUBLIC_API_URL=auto
ENV NEXT_PUBLIC_AUTH_MODE=${NEXT_PUBLIC_AUTH_MODE}

RUN addgroup -S appgroup && adduser -S -G appgroup appuser \
  && chown appuser:appgroup /app

COPY --chown=appuser:appgroup .next ./.next
COPY --chown=appuser:appgroup package.json ./package.json
COPY --chown=appuser:appgroup node_modules ./node_modules
COPY --chown=appuser:appgroup next.config.ts ./next.config.ts

USER appuser

EXPOSE 3000

CMD ["node_modules/.bin/next", "start"]
