import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("internAccounts")
      .withIndex("by_email", q => q.eq("email", args.email))
      .unique()
  },
})

export const getById = query({
  args: { id: v.id("internAccounts") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id)
  },
})

export const getByInternId = query({
  args: { internId: v.id("interns") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("internAccounts")
      .withIndex("by_internId", q => q.eq("internId", args.internId))
      .unique()
  },
})

export const getByInviteToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("internAccounts")
      .withIndex("by_inviteToken", q => q.eq("inviteToken", args.token))
      .unique()
  },
})

export const getWithProfile = query({
  args: { id: v.id("internAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.id)
    if (!account) return null
    const intern = await ctx.db.get(account.internId)
    return intern ? { ...account, intern } : null
  },
})

export const getLeaderboard = query({
  args: { supervisorId: v.optional(v.id("supervisors")) },
  handler: async (ctx, args) => {
    let accounts
    if (args.supervisorId) {
      accounts = await ctx.db
        .query("internAccounts")
        .withIndex("by_supervisorId", q => q.eq("supervisorId", args.supervisorId))
        .take(50)
    } else {
      accounts = await ctx.db.query("internAccounts").take(50)
    }
    const enriched = await Promise.all(
      accounts.map(async acc => {
        const intern = await ctx.db.get(acc.internId)
        return { ...acc, internName: intern?.fullName, internPhoto: intern?.photoUrl }
      }),
    )
    return enriched.sort((a, b) => b.xp - a.xp).slice(0, 20)
  },
})

export const create = mutation({
  args: {
    internId:     v.id("interns"),
    supervisorId: v.optional(v.id("supervisors")),
    email:        v.string(),
    passwordHash: v.string(),
    inviteToken:  v.optional(v.string()),
    inviteExpiry: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("internAccounts")
      .withIndex("by_email", q => q.eq("email", args.email))
      .unique()
    if (existing) throw new Error("Email already registered")
    return ctx.db.insert("internAccounts", {
      ...args,
      emailVerified:  false,
      level:          1,
      xp:             0,
      health:         100,
      streak:         0,
      achievements:   [],
      lastActiveDate: undefined,
      lastLogin:      undefined,
      fcmToken:       undefined,
    })
  },
})

export const update = mutation({
  args: {
    id:             v.id("internAccounts"),
    passwordHash:   v.optional(v.string()),
    emailVerified:  v.optional(v.boolean()),
    level:          v.optional(v.number()),
    xp:             v.optional(v.number()),
    health:         v.optional(v.number()),
    streak:         v.optional(v.number()),
    lastActiveDate: v.optional(v.number()),
    lastLogin:      v.optional(v.number()),
    achievements:   v.optional(v.array(v.string())),
    fcmToken:       v.optional(v.string()),
    inviteToken:    v.optional(v.string()),
    inviteExpiry:   v.optional(v.number()),
    supervisorId:   v.optional(v.id("supervisors")),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args
    await ctx.db.patch(id, patch)
  },
})
