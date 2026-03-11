# System-Wide Optimization Tasks

## ✅ COMPLETED
- [x] Voice Assistant - Voice Activity Detection (auto-stop after 2s silence)

## 🔄 IN PROGRESS

### 1. LOGS TAB
- [ ] Default to today's entries on load
- [ ] Add "Show All" toggle button
- [ ] Disable future dates in calendar picker
- [ ] Add "Print PDF" button next to CSV export
- [ ] Optimize /app/print/page.tsx for presentable printing
- [ ] Improve date/time sorting logic

### 2. STATIONS TAB
- [ ] Save grid settings to database (persist across sessions)
- [ ] Prevent PC stacking - only one PC per cell
- [ ] Auto-move stacked PCs to empty cells
- [ ] Enable network-wide ping (scan connected WiFi network)

### 3. NETWORK TAB
- [ ] Clean up design - reduce clutter
- [ ] Add device status indicators (online/offline/response time)

### 4. NOTICES TAB
- [ ] Add `dateStart` and `dateEnd` fields to announcements
- [ ] Make announcements visible on front page (above DTC Offices section)
- [ ] Add broadcast/active status based on date range
- [ ] Optimize announcement display

### 5. ANALYTICS TAB
- [ ] Add sign-in/sign-out events to audit trail
- [ ] Add check-in/check-out events to audit trail
- [ ] Show all relevant information in audit trail

### 6. SETTINGS TAB - STAFF & AUTH
- [ ] Add role hierarchy: SuperAdmin > Admin > Staff
- [ ] Email invitation system via Clerk
- [ ] One-time link invitations
- [ ] Show pending/accepted/total invitations
- [ ] Make login invite-only (only invited users can access)
- [ ] SuperAdmin as first login, rest as Admin by default

### 7. FRONT PAGE
- [ ] Add announcements section above DTC Offices
- [ ] Fix PC Modal to show grid settings layout
- [ ] Fix equipment validation: Computer + Internet Only = "Internet" (remove "Only")
- [ ] Fix validation issues

### 8. DASHBOARD
- [ ] Add "Check Out" action button to entries

## 📝 NOTES
- PWA offline caching is work-in-progress (save form data when offline, sync when online)
- All changes must be thoroughly tested before deployment
