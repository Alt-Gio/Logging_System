import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({

  // ── Walk-in client log entries ───────────────────────────────────────────
  logEntries: defineTable({
    fullName:             v.string(),
    agency:               v.string(),
    purpose:              v.string(),
    equipmentUsed:        v.array(v.string()),
    date:                 v.number(),
    timeIn:               v.number(),
    timeOut:              v.optional(v.number()),
    photoDataUrl:         v.optional(v.string()),
    photoUrl:             v.optional(v.string()),
    plannedDurationHours: v.number(),
    archived:             v.boolean(),
    serviceType:          v.union(v.literal("SELF_SERVICE"), v.literal("STAFF_ASSISTED")),
    staffNotes:           v.optional(v.string()),
    satisfactionRating:   v.optional(v.number()),
    contactEmail:         v.optional(v.string()),
    contactPhone:         v.optional(v.string()),
    pcId:                 v.optional(v.id("pcs")),
  })
    .index("by_timeIn",           ["timeIn"])
    .index("by_pcId",             ["pcId"])
    .index("by_archived",         ["archived"])
    .index("by_serviceType",      ["serviceType"])
    .index("by_date",             ["date"])
    .index("by_fullName",         ["fullName"])
    .index("by_agency",           ["agency"])
    .index("by_date_archived",    ["date", "archived"])
    .index("by_timeOut_archived", ["timeOut", "archived"])
    .searchIndex("search_fullName", { searchField: "fullName", filterFields: ["archived", "date"] })
    .searchIndex("search_agency",   { searchField: "agency",   filterFields: ["date"] }),

  // ── Workstations / PCs ───────────────────────────────────────────────────
  pcs: defineTable({
    name:       v.string(),
    ipAddress:  v.string(),
    macAddress: v.optional(v.string()),
    location:   v.optional(v.string()),
    isActive:   v.boolean(),
    lastSeen:   v.optional(v.number()),
    status:     v.union(
      v.literal("ONLINE"), v.literal("OFFLINE"),
      v.literal("IN_USE"), v.literal("MAINTENANCE"),
    ),
    ssid:     v.optional(v.string()),
    specs:    v.optional(v.string()),
    icon:     v.optional(v.string()),
    gridCol:  v.optional(v.number()),
    gridRow:  v.optional(v.number()),
  })
    .index("by_status",          ["status"])
    .index("by_isActive",        ["isActive"])
    .index("by_isActive_status", ["isActive", "status"])
    .index("by_ipAddress",       ["ipAddress"]),

  // ── Admin users ──────────────────────────────────────────────────────────
  admins: defineTable({
    username:        v.string(),
    passwordHash:    v.string(),
    name:            v.string(),
    role:            v.union(v.literal("SUPER_ADMIN"), v.literal("ADMIN"), v.literal("STAFF")),
    lastLoginAt:     v.optional(v.number()),
    tokenIdentifier: v.optional(v.string()),
  })
    .index("by_username",        ["username"])
    .index("by_tokenIdentifier", ["tokenIdentifier"]),

  // ── Admin audit trail ────────────────────────────────────────────────────
  adminLogs: defineTable({
    adminId:   v.optional(v.id("admins")),
    action:    v.string(),
    target:    v.optional(v.string()),
    detail:    v.optional(v.string()),
    ip:        v.optional(v.string()),
    userEmail: v.optional(v.string()),
    userName:  v.optional(v.string()),
  })
    .index("by_adminId", ["adminId"])
    .index("by_action",  ["action"]),

  // ── Security cameras ─────────────────────────────────────────────────────
  cameras: defineTable({
    name:      v.string(),
    url:       v.string(),
    type:      v.union(
      v.literal("MJPEG"), v.literal("SNAPSHOT"),
      v.literal("HLS"),   v.literal("RTSP_PROXY"),
    ),
    notes:     v.optional(v.string()),
    enabled:   v.boolean(),
    sortOrder: v.number(),
  })
    .index("by_enabled",   ["enabled"])
    .index("by_sortOrder", ["sortOrder"]),

  // ── Announcements ────────────────────────────────────────────────────────
  announcements: defineTable({
    title:     v.string(),
    body:      v.string(),
    type:      v.union(
      v.literal("INFO"),    v.literal("WARNING"),
      v.literal("MAINTENANCE"), v.literal("HOLIDAY"),
    ),
    active:    v.boolean(),
    dateStart: v.optional(v.number()),
    dateEnd:   v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    createdBy: v.optional(v.string()),
  })
    .index("by_active",           ["active"])
    .index("by_dateStart",        ["dateStart"])
    .index("by_dateEnd",          ["dateEnd"])
    .index("by_expiresAt",        ["expiresAt"])
    .index("by_active_expiresAt", ["active", "expiresAt"]),

  // ── App settings (key-value store) ───────────────────────────────────────
  settings: defineTable({
    key:   v.string(),
    value: v.string(),
  })
    .index("by_key", ["key"]),

  // ── Certificate templates ────────────────────────────────────────────────
  certificateTemplates: defineTable({
    name:          v.string(),
    description:   v.optional(v.string()),
    backgroundUrl: v.optional(v.string()),
    width:         v.number(),
    height:        v.number(),
    fields:        v.any(),
  }),

  // ── Issued certificates ──────────────────────────────────────────────────
  certificates: defineTable({
    internId:   v.optional(v.id("interns")),
    templateId: v.id("certificateTemplates"),
    data:       v.any(),
    pdfUrl:     v.optional(v.string()),
    issuedAt:   v.number(),
  })
    .index("by_internId",   ["internId"])
    .index("by_templateId", ["templateId"]),

  // ── Intern profiles ──────────────────────────────────────────────────────
  interns: defineTable({
    fullName:         v.string(),
    school:           v.string(),
    course:           v.string(),
    department:       v.optional(v.string()),
    supervisor:       v.optional(v.string()),
    startDate:        v.number(),
    endDate:          v.number(),
    requiredHours:    v.number(),
    status:           v.union(
      v.literal("ACTIVE"),  v.literal("COMPLETED"),
      v.literal("INACTIVE"), v.literal("ON_LEAVE"),
    ),
    email:            v.optional(v.string()),
    phone:            v.optional(v.string()),
    photoUrl:         v.optional(v.string()),
    notes:            v.optional(v.string()),
    totalHoursLogged: v.optional(v.number()),
    completedTasks:   v.optional(v.number()),
  })
    .index("by_status",    ["status"])
    .index("by_startDate", ["startDate"])
    .searchIndex("search_fullName", { searchField: "fullName", filterFields: ["status"] }),

  // ── Intern daily attendance ──────────────────────────────────────────────
  internAttendance: defineTable({
    internId: v.id("interns"),
    date:     v.number(),
    timeIn:   v.optional(v.number()),
    timeOut:  v.optional(v.number()),
    hours:    v.optional(v.number()),
    status:   v.union(
      v.literal("PRESENT"), v.literal("ABSENT"),
      v.literal("HALF_DAY"), v.literal("LEAVE"), v.literal("HOLIDAY"),
    ),
    notes: v.optional(v.string()),
  })
    .index("by_internId",      ["internId"])
    .index("by_date",          ["date"])
    .index("by_internId_date", ["internId", "date"]),

  // ── Intern tasks ─────────────────────────────────────────────────────────
  internTasks: defineTable({
    internId:            v.optional(v.id("interns")),
    title:               v.string(),
    description:         v.optional(v.string()),
    status:              v.union(
      v.literal("PENDING"),    v.literal("IN_PROGRESS"),
      v.literal("COMPLETED"),  v.literal("CANCELLED"),
    ),
    priority: v.union(
      v.literal("LOW"),  v.literal("MEDIUM"),
      v.literal("HIGH"), v.literal("URGENT"),
    ),
    dueDate:             v.optional(v.number()),
    completedAt:         v.optional(v.number()),
    createdBy:           v.optional(v.id("admins")),
    createdBySupervisor: v.optional(v.id("supervisors")),
    taskId:              v.string(),
    difficulty:          v.optional(v.union(
      v.literal("trivial"), v.literal("easy"),
      v.literal("medium"),  v.literal("hard"), v.literal("epic"),
    )),
    xpReward:            v.optional(v.number()),
    type:                v.optional(v.union(
      v.literal("daily"), v.literal("todo"), v.literal("habit"),
    )),
  })
    .index("by_internId",            ["internId"])
    .index("by_status",              ["status"])
    .index("by_taskId",              ["taskId"])
    .index("by_createdBySupervisor", ["createdBySupervisor"]),

  // ── Task comments ────────────────────────────────────────────────────────
  taskComments: defineTable({
    taskId:     v.id("internTasks"),
    authorId:   v.string(),
    authorType: v.union(v.literal("admin"), v.literal("intern")),
    message:    v.string(),
  })
    .index("by_taskId", ["taskId"]),

  // ── Intern documents ─────────────────────────────────────────────────────
  internDocuments: defineTable({
    internId:       v.id("interns"),
    name:           v.string(),
    type:           v.string(),
    url:            v.string(),
    uploadedBy:     v.optional(v.string()),
    storageId:      v.optional(v.id("_storage")),
    tags:           v.optional(v.array(v.string())),
    syncedToSheets: v.optional(v.boolean()),
    syncedAt:       v.optional(v.number()),
  })
    .index("by_internId", ["internId"]),

  // ── Intern sessions (time-in/time-out) ───────────────────────────────────
  internSessions: defineTable({
    internId:     v.id("interns"),
    timeIn:       v.number(),
    timeOut:      v.optional(v.number()),
    status:       v.union(v.literal("ACTIVE"), v.literal("CLOSED")),
    progressNote: v.optional(v.string()),
    closedBy:     v.optional(v.string()),
    hoursLogged:  v.optional(v.number()),
  })
    .index("by_internId",        ["internId"])
    .index("by_status",          ["status"])
    .index("by_timeIn",          ["timeIn"])
    .index("by_internId_status", ["internId", "status"]),

  // ── OTP verification ─────────────────────────────────────────────────────
  otpVerifications: defineTable({
    contact:     v.string(),
    contactType: v.string(),
    otpCode:     v.string(),
    purpose:     v.string(),
    verified:    v.boolean(),
    expiresAt:   v.number(),
  })
    .index("by_contact",   ["contact"])
    .index("by_expiresAt", ["expiresAt"]),

  // ── Google Sheets sync log ───────────────────────────────────────────────
  sheetSyncLog: defineTable({
    syncedAt:       v.number(),
    recordsSynced:  v.number(),
    recordsFlagged: v.number(),
    errorCount:     v.number(),
    triggeredBy:    v.union(v.literal("cron"), v.literal("manual"), v.literal("webhook")),
    errors:         v.optional(v.array(v.string())),
  })
    .index("by_syncedAt", ["syncedAt"]),

  // ── Supervisors ──────────────────────────────────────────────────────────
  supervisors: defineTable({
    email:         v.string(),
    name:          v.string(),
    department:    v.string(),
    passwordHash:  v.string(),
    emailVerified: v.boolean(),
    adminId:       v.optional(v.id("admins")),
    fcmToken:      v.optional(v.string()),
    lastLogin:     v.optional(v.number()),
    inviteToken:   v.optional(v.string()),
    inviteExpiry:  v.optional(v.number()),
  })
    .index("by_email",       ["email"])
    .index("by_adminId",     ["adminId"])
    .index("by_inviteToken", ["inviteToken"]),

  // ── Intern personal accounts (gamification layer) ────────────────────────
  internAccounts: defineTable({
    internId:       v.id("interns"),
    supervisorId:   v.optional(v.id("supervisors")),
    email:          v.string(),
    passwordHash:   v.string(),
    emailVerified:  v.boolean(),
    level:          v.number(),
    xp:             v.number(),
    health:         v.number(),
    streak:         v.number(),
    lastActiveDate: v.optional(v.number()),
    lastLogin:      v.optional(v.number()),
    achievements:   v.array(v.string()),
    fcmToken:       v.optional(v.string()),
    inviteToken:    v.optional(v.string()),
    inviteExpiry:   v.optional(v.number()),
  })
    .index("by_email",        ["email"])
    .index("by_internId",     ["internId"])
    .index("by_supervisorId", ["supervisorId"])
    .index("by_inviteToken",  ["inviteToken"]),

  // ── Daily / weekly habits ─────────────────────────────────────────────────
  internHabits: defineTable({
    title:          v.string(),
    description:    v.optional(v.string()),
    difficulty:     v.union(
      v.literal("trivial"), v.literal("easy"),
      v.literal("medium"),  v.literal("hard"), v.literal("epic"),
    ),
    frequency:      v.union(v.literal("daily"), v.literal("weekly")),
    positive:       v.boolean(),
    active:         v.boolean(),
    xpReward:       v.number(),
    supervisorId:   v.optional(v.id("supervisors")),
    targetInternId: v.optional(v.id("interns")),
  })
    .index("by_supervisorId",   ["supervisorId"])
    .index("by_active",         ["active"])
    .index("by_targetInternId", ["targetInternId"]),

  // ── Habit completion log (one row per intern per habit per day) ───────────
  internHabitLogs: defineTable({
    habitId:     v.id("internHabits"),
    internId:    v.id("interns"),
    date:        v.number(),
    completed:   v.boolean(),
    completedAt: v.optional(v.number()),
  })
    .index("by_habitId",               ["habitId"])
    .index("by_internId",              ["internId"])
    .index("by_internId_date",         ["internId", "date"])
    .index("by_habitId_internId_date", ["habitId", "internId", "date"]),

  // ── Notifications inbox ───────────────────────────────────────────────────
  notifications: defineTable({
    recipientId:   v.string(),
    recipientType: v.union(
      v.literal("intern"), v.literal("supervisor"), v.literal("admin"),
    ),
    title:     v.string(),
    body:      v.string(),
    type:      v.union(
      v.literal("task"),         v.literal("timein"),
      v.literal("timeout"),      v.literal("xp"),
      v.literal("announcement"), v.literal("warning"),
      v.literal("achievement"),  v.literal("levelup"),
    ),
    read:      v.boolean(),
    createdAt: v.number(),
    link:      v.optional(v.string()),
  })
    .index("by_recipientId",      ["recipientId"])
    .index("by_recipientId_read", ["recipientId", "read"])
    .index("by_createdAt",        ["createdAt"]),

  // ── XP audit ledger ───────────────────────────────────────────────────────
  xpLedger: defineTable({
    internId:  v.id("interns"),
    accountId: v.id("internAccounts"),
    xp:        v.number(),
    reason:    v.string(),
    taskId:    v.optional(v.id("internTasks")),
    createdAt: v.number(),
  })
    .index("by_internId",           ["internId"])
    .index("by_accountId",          ["accountId"])
    .index("by_internId_createdAt", ["internId", "createdAt"]),
})
