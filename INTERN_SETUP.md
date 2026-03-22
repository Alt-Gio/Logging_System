# Intern Logbook Setup Guide

## Quick Start - Initialize Sample Data

The intern logbook needs sample data to function. Follow these steps:

### Option 1: Using the API Endpoint (Recommended)

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Call the seed endpoint:**
   Open your browser or use curl:
   ```bash
   curl -X POST http://localhost:3000/api/interns/seed
   ```

   Or visit in browser and use the Network tab to send a POST request to:
   ```
   http://localhost:3000/api/interns/seed
   ```

3. **Verify the data:**
   Navigate to `http://localhost:3000/intern-logbook`
   
   You should see 5 sample interns:
   - Maria Santos (Bicol University)
   - John Paul Reyes (Aquinas University)
   - Angela Cruz (Divine Word College)
   - Carlos Mendoza (Bicol University)
   - Patricia Lim (Aquinas University)

### Option 2: Using Prisma Seed (Production)

If you have access to the production database:

```bash
npm run db:seed
```

This will run the `prisma/seed.ts` file which creates the same sample data.

## What Gets Created

Each sample intern includes:
- **Personal Info:** Name, school, course, contact details
- **Internship Period:** 2 months ago → 2 months from now
- **Required Hours:** 486 hours (standard OJT requirement)
- **Status:** ACTIVE
- **Attendance Records:** ~10 days of sample attendance from the past 2 weeks
- **Hours Logged:** ~80-90 hours per intern

## Features Now Working

### Desktop View
- **Split Panel Layout:** Intern list on left, details on right
- **Active Interns Panel:** Shows all currently clocked-in interns at the top
- **Live Timer:** Real-time elapsed time for clocked-in interns
- **Search:** Filter by name or school

### Mobile View
- **Bottom Sheet:** Tap an intern to see details in a slide-up panel
- **Active Strip:** Clocked-in interns always visible at top
- **Touch Optimized:** Large tap targets, smooth animations

### Time Tracking
- **Time In/Out:** Tap buttons to clock in/out
- **Confirmation Modal:** Prevents accidental time-outs
- **Persistent State:** Clock-in state saved to localStorage
- **Auto-calculation:** Hours computed automatically

### Attendance Display
- **Week Bar:** Visual progress for Mon-Fri current week
- **Today's Sessions:** All time-in/out records for today
- **Recent History:** Expandable table of past attendance
- **Progress Ring:** Visual completion percentage

## API Endpoints

All working and tested:

- `GET /api/interns?status=ACTIVE` - Fetch active interns
- `POST /api/interns` - Create new intern
- `POST /api/interns/[id]/attendance` - Log attendance
- `POST /api/interns/seed` - Initialize sample data

## Troubleshooting

### "No active interns" message
- Run the seed endpoint (Option 1 above)
- Check browser console for API errors
- Verify DATABASE_URL in .env is correct

### Data not loading
- Check Network tab in browser DevTools
- Look for failed API calls to `/api/interns`
- Check server logs for database connection errors

### Clock-in state lost on refresh
- This is expected - localStorage is cleared
- Real production would persist to database via API

## Next Steps

1. **Add Real Interns:** Use the admin panel at `/interns` to add actual intern records
2. **Import from CSV:** Use the bulk import feature (if available)
3. **Configure Email:** Set RESEND_API_KEY to enable email notifications
4. **Set up Photos:** Configure Cloudinary for intern profile photos
