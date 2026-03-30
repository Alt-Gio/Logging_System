import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("internAccounts").collect()
  }
})

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("internAccounts")
      .withIndex("by_email", q => q.eq("email", args.email))
      .first()
  }
})

export const getByInternId = query({
  args: { internId: v.id("interns") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("internAccounts")
      .withIndex("by_internId", q => q.eq("internId", args.internId))
      .first()
  }
})

export const create = mutation({
  args: {
    internId:    v.id("interns"),
    email:       v.string(),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("internAccounts")
      .withIndex("by_email", q => q.eq("email", args.email))
      .first()
    if (existing) throw new Error("Account already exists")

    return ctx.db.insert("internAccounts", {
      internId:      args.internId,
      email:         args.email,
      passwordHash:  args.passwordHash,
      emailVerified: true,
      level:         1,
      xp:            0,
      health:        100,
      streak:        0,
      achievements:  [],
    })
  }
})

export const updateFcmToken = mutation({
  args: {
    id:       v.id("internAccounts"),
    fcmToken: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { fcmToken: args.fcmToken })
  }
})

export const updateLastLogin = mutation({
  args: { id: v.id("internAccounts") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      lastLogin:      Date.now(),
      lastActiveDate: Date.now(),
    })
  }
})

export const update = mutation({
  args: {
    id:             v.id("internAccounts"),
    lastLogin:      v.optional(v.number()),
    lastActiveDate: v.optional(v.number()),
    fcmToken:       v.optional(v.string()),
    emailVerified:  v.optional(v.boolean()),
    level:          v.optional(v.number()),
    xp:             v.optional(v.number()),
    health:         v.optional(v.number()),
    streak:         v.optional(v.number()),
    achievements:   v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([_, v]) => v !== undefined)
    )
    await ctx.db.patch(id, clean)
  }
})

export const getById = query({
  args: { id: v.id("internAccounts") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id)
  }
})
