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

# NEXT_PUBLIC_CONVEX_URL is baked into the browser bundle at build time.
# Pass the external URL the browser uses to reach the Convex backend.
# Example (self-hosted SSL via nginx):  --build-arg NEXT_PUBLIC_CONVEX_URL=https://dict.example.com:3210
# Example (LAN plain HTTP):             --build-arg NEXT_PUBLIC_CONVEX_URL=http://192.168.1.100:3210
ARG  NEXT_PUBLIC_CONVEX_URL=http://localhost:3210
ENV  NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Generate Convex TypeScript types from local schema (no backend connection needed)
RUN npx convex codegen 2>/dev/null || echo "[warn] convex codegen skipped - run npx convex dev --url <url> locally first"
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

# Keep Prisma client for any remaining fallback routes during migration
COPY --from=builder /app/node_modules/.prisma      ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma      ./node_modules/@prisma
COPY --from=builder /app/package.json              ./package.json

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
