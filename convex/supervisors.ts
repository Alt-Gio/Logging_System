import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("supervisors")
      .withIndex("by_email", q => q.eq("email", args.email))
      .unique()
  },
})

export const getById = query({
  args: { id: v.id("supervisors") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id)
  },
})

export const getByInviteToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("supervisors")
      .withIndex("by_inviteToken", q => q.eq("inviteToken", args.token))
      .unique()
  },
})

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("supervisors").take(100)
  },
})

export const create = mutation({
  args: {
    email:        v.string(),
    name:         v.string(),
    department:   v.string(),
    phone:        v.optional(v.string()),
    position:     v.optional(v.string()),
    schoolId:     v.optional(v.id("schools")),
    passwordHash: v.optional(v.string()),
    adminId:      v.optional(v.id("admins")),
    inviteToken:  v.optional(v.string()),
    inviteExpiry: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("supervisors")
      .withIndex("by_email", q => q.eq("email", args.email))
      .unique()
    if (existing) throw new Error("Email already registered")
    return ctx.db.insert("supervisors", {
      ...args,
      emailVerified: false,
      lastLogin:     undefined,
      fcmToken:      undefined,
    })
  },
})

export const update = mutation({
  args: {
    id:            v.id("supervisors"),
    name:          v.optional(v.string()),
    department:    v.optional(v.string()),
    phone:         v.optional(v.string()),
    position:      v.optional(v.string()),
    schoolId:      v.optional(v.id("schools")),
    passwordHash:  v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    fcmToken:      v.optional(v.string()),
    lastLogin:     v.optional(v.number()),
    inviteToken:   v.optional(v.string()),
    inviteExpiry:  v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args
    await ctx.db.patch(id, patch)
  },
})

export const upsertOtp = mutation({
  args: { email: v.string(), code: v.string(), expiresAt: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("otpVerifications")
      .withIndex("by_contact", q => q.eq("contact", args.email.toLowerCase()))
      .filter(q => q.eq(q.field("purpose"), "supervisor_login"))
      .first()
    const data = {
      contact:     args.email.toLowerCase(),
      contactType: "email",
      otpCode:     args.code,
      purpose:     "supervisor_login",
      verified:    false,
      expiresAt:   args.expiresAt,
    }
    if (existing) {
      await ctx.db.patch(existing._id, data)
    } else {
      await ctx.db.insert("otpVerifications", data)
    }
  },
})

export const verifyOtp = mutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("otpVerifications")
      .withIndex("by_contact", q => q.eq("contact", args.email.toLowerCase()))
      .filter(q => q.eq(q.field("purpose"), "supervisor_login"))
      .first()
    if (!row) return { ok: false, error: "No OTP found" }
    if (row.verified) return { ok: false, error: "OTP already used" }
    if (row.expiresAt < Date.now()) return { ok: false, error: "OTP expired" }
    if (row.otpCode !== args.code) return { ok: false, error: "Incorrect code" }
    await ctx.db.patch(row._id, { verified: true })
    return { ok: true }
  },
})

export const getMyInterns = query({
  args: { supervisorId: v.id("supervisors") },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("internAccounts")
      .withIndex("by_supervisorId", q => q.eq("supervisorId", args.supervisorId))
      .take(100)
    return Promise.all(
      accounts.map(async acc => {
        const intern = await ctx.db.get(acc.internId)
        return intern ? { ...intern, account: acc } : null
      }),
    ).then(list => list.filter(Boolean))
  },
})
