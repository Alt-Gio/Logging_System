# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# ── Stage 2: builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js standalone (npm run build already runs prisma generate)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# ── Stage 3: runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser  --system --uid 1001 nextjs

# Standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static    ./.next/static
COPY --from=builder /app/public          ./public

# Prisma client + CLI + schema for runtime migrations
COPY --from=builder /app/node_modules/.prisma      ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma      ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma       ./node_modules/prisma
COPY --from=builder /app/prisma                    ./prisma
COPY --from=builder /app/package.json              ./package.json

# Make 'prisma' available in PATH so any caller (CMD, pre-deploy, scripts) can use it
RUN printf '#!/bin/sh\nexec node /app/node_modules/prisma/build/index.js "$@"\n' \
      > /usr/local/bin/prisma \
    && chmod +x /usr/local/bin/prisma

USER nextjs
EXPOSE 3000

CMD ["sh", "-c", "prisma migrate deploy && node server.js"]
