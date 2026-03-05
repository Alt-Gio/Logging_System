# Free Services Setup Guide — DICT DTC Logbook v10

## 1. Pusher (Real-time updates + Notifications)
**Free tier:** 200k messages/day, 100 connections

1. Go to https://pusher.com → Sign up free
2. Create App → Name: "dict-dtc-logbook" → Cluster: ap1 (Singapore, closest to PH)
3. Go to App Keys → copy App ID, Key, Secret
4. Add to Railway environment variables:
   ```
   PUSHER_APP_ID=your_app_id
   PUSHER_KEY=your_key
   PUSHER_SECRET=your_secret
   PUSHER_CLUSTER=ap1
   NEXT_PUBLIC_PUSHER_KEY=your_key
   NEXT_PUBLIC_PUSHER_CLUSTER=ap1
   ```

## 2. Cloudinary (Photo storage — replaces base64 in DB)
**Free tier:** 25GB storage, 25GB bandwidth/month

1. Go to https://cloudinary.com → Sign up free
2. Dashboard → copy Cloud Name, API Key, API Secret
3. Add to Railway:
   ```
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

## 3. QStash by Upstash (Auto-expiry cron — every 5 minutes)
**Free tier:** 500 messages/day

1. Go to https://upstash.com → Sign up free → QStash
2. Create a schedule:
   - URL: https://your-app.railway.app/api/cron
   - Method: POST
   - Schedule: every 5 minutes (*/5 * * * *)
   - Header: Authorization: Bearer your_cron_secret
3. Add to Railway:
   ```
   CRON_SECRET=any_random_string_like_dict2026cron
   NEXT_PUBLIC_APP_URL=https://your-app.railway.app
   ```
   
**Alternative (no QStash):** Set CRON_SECRET and call manually or use a free cron service like:
- https://cron-job.org (free, reliable, just set URL + every 5 min)

## 4. After adding env vars — run migration
```bash
npx prisma db push
```
This adds the Camera and AdminLog tables.

## 5. PWA Icons
Place these in /public/:
- icon-192.png (192×192px, DICT seal or app icon)
- icon-512.png (512×512px, same)

Without these the PWA still works, just uses browser default icon.

## 6. Print Reports
Access: https://your-app.railway.app/print?date=2026-03-05
- Works without any setup
- Click 🖨 Print or Ctrl+P
- Or access from admin Dashboard → "Print Today"

## Summary
| Service | Free Limit | Setup Time |
|---------|-----------|------------|
| Pusher  | 200k msg/day | 5 minutes |
| Cloudinary | 25GB | 5 minutes |
| QStash/cron-job.org | 500/day or unlimited | 5 minutes |
| PWA | Free (npm) | Already included |
| Print page | Free | Already included |
| Audit log | Free (your DB) | Already included |
