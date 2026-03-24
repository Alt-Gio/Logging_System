import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

// Auto-close active intern sessions at 5PM PHT (09:00 UTC) Mon-Fri
crons.weekly("close-sessions-mon", { dayOfWeek: "monday",    hourUTC: 9, minuteUTC: 0 }, internal.internSessions.autoCloseAllSessions, {})
crons.weekly("close-sessions-tue", { dayOfWeek: "tuesday",   hourUTC: 9, minuteUTC: 0 }, internal.internSessions.autoCloseAllSessions, {})
crons.weekly("close-sessions-wed", { dayOfWeek: "wednesday", hourUTC: 9, minuteUTC: 0 }, internal.internSessions.autoCloseAllSessions, {})
crons.weekly("close-sessions-thu", { dayOfWeek: "thursday",  hourUTC: 9, minuteUTC: 0 }, internal.internSessions.autoCloseAllSessions, {})
crons.weekly("close-sessions-fri", { dayOfWeek: "friday",    hourUTC: 9, minuteUTC: 0 }, internal.internSessions.autoCloseAllSessions, {})

// Sync Google Sheets every 30 minutes
crons.interval("sync-sheets", { minutes: 30 }, internal.sheets.syncStaffSheet, {})

// Clean expired OTP codes every hour
crons.interval("clean-otps", { hours: 1 }, internal.otpVerifications.cleanExpired, {})

// Daily backup snapshot at 2AM PHT (6PM UTC previous day)
crons.daily("daily-snapshot", { hourUTC: 18, minuteUTC: 0 }, internal.backup.createSnapshot, {})

export default crons
