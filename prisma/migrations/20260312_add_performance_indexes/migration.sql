-- Add performance indexes for LogEntry table
CREATE INDEX IF NOT EXISTS "log_entries_date_idx" ON "log_entries"("date");
CREATE INDEX IF NOT EXISTS "log_entries_fullName_idx" ON "log_entries"("fullName");
CREATE INDEX IF NOT EXISTS "log_entries_agency_idx" ON "log_entries"("agency");
CREATE INDEX IF NOT EXISTS "log_entries_createdAt_idx" ON "log_entries"("createdAt");
CREATE INDEX IF NOT EXISTS "log_entries_date_archived_idx" ON "log_entries"("date", "archived");
CREATE INDEX IF NOT EXISTS "log_entries_timeOut_archived_idx" ON "log_entries"("timeOut", "archived");

-- Add performance indexes for PC table
CREATE INDEX IF NOT EXISTS "pcs_status_idx" ON "pcs"("status");
CREATE INDEX IF NOT EXISTS "pcs_isActive_idx" ON "pcs"("isActive");
CREATE INDEX IF NOT EXISTS "pcs_isActive_status_idx" ON "pcs"("isActive", "status");

-- Add performance indexes for Announcement table
CREATE INDEX IF NOT EXISTS "announcements_expiresAt_idx" ON "announcements"("expiresAt");
CREATE INDEX IF NOT EXISTS "announcements_active_expiresAt_idx" ON "announcements"("active", "expiresAt");
