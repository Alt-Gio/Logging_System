# Convex Self-Hosted Setup Guide

The app uses a **self-hosted Convex backend** running in Docker (WSL or any host).  
All real-time queries, mutations, and scheduled jobs run through it.

---

## Architecture

```
Browser ──WebSocket──► nginx :3210 (SSL) ──► convex-backend :3210 (internal)
Next.js API routes ──HTTP──────────────────► convex-backend :3210 (internal Docker network)
```

---

## 1 · First-Time Setup (on the WSL / host machine)

### Step 1 — Start the Convex backend

```bash
docker compose up convex-backend -d
```

Verify it's running:
```bash
curl http://localhost:3210/version
```

### Step 2 — Copy and fill env files

```bash
# For local Next.js dev
cp .env.local.example .env.local
# Edit CONVEX_ADMIN_KEY to match what's in your docker-compose .env / shell env
```

### Step 3 — Push schema + generate TypeScript types

```bash
# Installs schema and functions to your local Convex backend
# Also generates convex/_generated/ (type-safe API references)
npm run convex:dev
# Press Ctrl+C after it says "Convex functions ready"  (or use --once flag)
```

> `npm run convex:dev` watches for changes. Use `npx convex deploy --url http://127.0.0.1:3210` for a one-shot push.

### Step 4 — Seed the first admin account

```bash
npm run convex:seed
# Creates: username=admin  password=Dict2026  role=SUPER_ADMIN
# Change the password immediately after first login.
```

### Step 5 — Run the Next.js dev server

```bash
npm run dev
```

Open http://localhost:3000 → sign in at /sign-in with `admin` / `Dict2026`.

---

## 2 · Other Computers on the Same LAN

No extra setup on the Convex backend is needed — it's already listening on port 3210.

On the **other computer**:

1. Clone the repo.
2. Copy `.env.local.example` → `.env.local`.
3. Set `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_URL` to the **host machine's LAN IP**:
   ```env
   NEXT_PUBLIC_CONVEX_URL=http://192.168.1.50:3210
   CONVEX_URL=http://192.168.1.50:3210
   CONVEX_ADMIN_KEY=insecure-local-admin-key-change-me
   ```
4. Run `npm run dev` — the app connects to the remote Convex backend in real-time.

> Find your WSL host IP: `ip route show default | awk '{print $3}'` inside WSL,  
> or `ipconfig` on Windows → find the WSL virtual adapter.

---

## 3 · Docker Compose Full Stack (production-like)

```bash
# Build image — pass the external URL the browser will use for Convex WebSocket
docker build \
  --build-arg NEXT_PUBLIC_CONVEX_URL=https://your-domain.com:3210 \
  -t dict-logbook:latest .

# Start all services (Convex + Postgres + App + Nginx)
docker compose up -d

# Push schema to the Convex container (run once after first deploy)
docker compose exec app npx convex deploy --url http://convex-backend:3210

# Seed admin account
docker compose exec app npx tsx convex/seed.ts
```

After starting, push schema from the host:
```bash
NEXT_PUBLIC_CONVEX_URL=http://localhost:3210 npm run convex:push
```

---

## 4 · Port Reference

| Port | Service | Notes |
|------|---------|-------|
| 3000 | Next.js app | dev server |
| 3210 | Convex backend | direct HTTP + WebSocket |
| 3210 (external) | nginx SSL proxy | maps to internal port 3211 → convex:3210 |
| 443 | nginx HTTPS | Next.js app |

---

## 5 · Schema Changes

After editing any file in `convex/`:

```bash
npm run convex:dev   # auto-pushes on save (dev)
# or
npm run convex:push  # one-shot push
```

The `convex/_generated/` directory is auto-updated — commit it after schema changes.

---

## 6 · Data Persistence

Convex data is stored in the `convex_data` Docker volume.

```bash
# Backup
docker run --rm -v logging_system_convex_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/convex-backup-$(date +%Y%m%d).tar.gz -C /data .

# Restore
docker run --rm -v logging_system_convex_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/convex-backup-YYYYMMDD.tar.gz -C /data
```
