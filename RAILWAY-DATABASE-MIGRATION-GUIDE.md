# Railway Database Migration Guide

## Problem
You're trying to run `npx prisma migrate deploy` locally, but it can't connect to the Railway database because:
1. Railway databases use internal networking when deployed
2. Your local machine needs the **public URL** to connect
3. The migrations need to run **on Railway**, not locally

## ✅ Solution: Run Migrations on Railway

### Option 1: Railway CLI (Recommended)

**Step 1: Make sure you're linked to the project**
```bash
railway link
# Select: honest-simplicity
# Select environment: production
# Select service: Logging_System
```

**Step 2: Run migrations on Railway**
```bash
railway run npx prisma migrate deploy
```

This runs the command **on Railway's servers** where it can access the internal database.

---

### Option 2: Railway Dashboard

**Step 1: Go to Railway Dashboard**
1. Visit https://railway.app/dashboard
2. Select your project: **honest-simplicity**
3. Click on **Logging_System** service

**Step 2: Open Service Settings**
1. Click **Settings** tab
2. Scroll to **Deploy** section

**Step 3: Add Migration Command**
1. Under **Build Command**, keep it as is
2. Under **Deploy Command**, you can temporarily change it to:
   ```
   npx prisma migrate deploy && npm start
   ```
3. Or use the **Custom Start Command** in Settings

**Step 4: Trigger Deployment**
- Click **Deploy** → **Redeploy**
- Migrations will run automatically before the app starts

---

### Option 3: Add to Build Process (Permanent Solution)

**Edit `package.json`:**
```json
{
  "scripts": {
    "build": "next build",
    "start": "next start",
    "postinstall": "prisma generate",
    "deploy": "prisma migrate deploy && npm start"
  }
}
```

**Update Railway Settings:**
- Deploy Command: `npm run deploy`

This ensures migrations run on every deployment.

---

## 🔍 Why Local Migration Fails

**The Error:**
```
Error: P1001: Can't reach database server at `tramway.proxy.rlwy.net:40029`
```

**Reasons:**
1. **DATABASE_PUBLIC_URL** - You changed schema.prisma to use this, but it's not set in your local `.env`
2. **Public URL** - Railway databases have both:
   - **Private URL** (`postgres.railway.internal`) - Only works inside Railway
   - **Public URL** (`tramway.proxy.rlwy.net`) - Works from anywhere, but needs to be enabled

---

## 🔧 If You MUST Run Migrations Locally

### Step 1: Get Railway Database Public URL

**Via Railway Dashboard:**
1. Go to your project: **honest-simplicity**
2. Click on **Postgres** database service (not Logging_System)
3. Go to **Variables** tab
4. Find `DATABASE_PUBLIC_URL` or `DATABASE_URL`
5. Copy the full connection string

**Via Railway CLI:**
```bash
railway variables
```

### Step 2: Create Local `.env` File

Create `c:\Users\actal\Documents\Logging_System\.env`:
```env
# Railway Database Public URL
DATABASE_PUBLIC_URL="postgresql://postgres:PASSWORD@tramway.proxy.rlwy.net:40029/railway"

# Copy other required vars from Railway dashboard
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
GROQ_API_KEY="gsk_..."
```

### Step 3: Run Migrations
```bash
npx prisma migrate deploy
```

---

## ⚠️ Important Notes

### Schema.prisma Change
You changed:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_PUBLIC_URL")  // ← Changed from DATABASE_URL
}
```

**This means:**
- Railway needs `DATABASE_PUBLIC_URL` environment variable set
- OR you need to change it back to `DATABASE_URL`

### Recommended: Revert Schema Change

**Change back to:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Why?**
- Railway automatically provides `DATABASE_URL`
- No need to manually set `DATABASE_PUBLIC_URL`
- Works both locally and on Railway

---

## 🚀 Quick Fix Steps

**1. Revert schema.prisma:**
```bash
# Change line 7 back to:
url = env("DATABASE_URL")
```

**2. Commit and push:**
```bash
git add prisma/schema.prisma
git commit -m "Revert to DATABASE_URL for Railway compatibility"
git push
```

**3. Run migrations on Railway:**
```bash
railway run npx prisma migrate deploy
```

**4. Verify deployment:**
- Railway will auto-deploy
- Check logs for migration success
- Test at https://dict-logbook.up.railway.app

---

## 📋 Migration Files to Deploy

You have 2 pending migrations:
1. `20260311_add_announcement_date_range/migration.sql`
   - Adds `dateStart` and `dateEnd` to announcements
2. `20260311_add_audit_trail_fields/migration.sql`
   - Adds `userEmail` and `userName` to admin_logs

These will be applied when you run `prisma migrate deploy` on Railway.

---

## ✅ Success Checklist

After running migrations, verify:
- [ ] No migration errors in Railway logs
- [ ] Announcements can be created with date ranges
- [ ] Admin panel loads without errors
- [ ] Logbook submissions work
- [ ] No database schema errors

---

## 🆘 Troubleshooting

### "Can't reach database server"
- **Solution:** Use `railway run` instead of running locally
- **Or:** Get public URL from Railway dashboard

### "Environment variable not found"
- **Solution:** Check Railway service variables
- **Ensure:** `DATABASE_URL` is set (Railway sets this automatically)

### "Migration already applied"
- **This is OK!** It means migrations ran successfully before
- **Check:** `railway logs` to see migration output

### "Schema drift detected"
- **Solution:** Run `railway run npx prisma migrate dev` to create new migration
- **Or:** Run `railway run npx prisma db push` to sync without migration file
