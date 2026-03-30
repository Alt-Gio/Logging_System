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
    internId:     v.id("interns"),
    email:        v.string(),
    passwordHash: v.string(),
    supervisorId: v.optional(v.id("supervisors")),
    inviteToken:  v.optional(v.string()),
    inviteExpiry: v.optional(v.number()),
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
      supervisorId:  args.supervisorId,
      inviteToken:   args.inviteToken,
      inviteExpiry:  args.inviteExpiry,
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
    passwordHash:   v.optional(v.string()),
    supervisorId:   v.optional(v.id("supervisors")),
    inviteToken:    v.optional(v.string()),
    inviteExpiry:   v.optional(v.number()),
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

export const getLeaderboard = query({
  args: {
    supervisorId: v.optional(v.id("supervisors")),
  },
  handler: async (ctx, args) => {
    const accounts = args.supervisorId
      ? await ctx.db
          .query("internAccounts")
          .withIndex("by_supervisorId", q => q.eq("supervisorId", args.supervisorId))
          .collect()
      : await ctx.db.query("internAccounts").collect()

    const enriched = await Promise.all(
      accounts.map(async (a) => {
        const intern = await ctx.db.get(a.internId)
        return {
          id:       a._id,
          internId: a.internId,
          name:     intern?.fullName ?? "Unknown",
          level:    a.level ?? 1,
          xp:       a.xp ?? 0,
          health:   a.health ?? 100,
          streak:   a.streak ?? 0,
          achievements: a.achievements ?? [],
        }
      })
    )

    return enriched.sort((a, b) => b.xp - a.xp)
  }
})

export const getByInviteToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("internAccounts")
      .withIndex("by_inviteToken", q => q.eq("inviteToken", args.token))
      .first()
  }
})

export const createWithInvite = mutation({
  args: {
    internId:    v.id("interns"),
    email:       v.string(),
    passwordHash: v.string(),
    inviteToken: v.optional(v.string()),
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

export const awardXP = mutation({
  args: {
    id:     v.id("internAccounts"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.id)
    if (!account) throw new Error("Account not found")

    const newXP = (account.xp ?? 0) + args.amount
    let level = 1
    let remaining = newXP
    while (remaining >= level * 100) {
      remaining -= level * 100
      level++
    }

    await ctx.db.patch(args.id, {
      xp:    newXP,
      level,
      lastActiveDate: Date.now(),
    })

    return { newXP, level }
  }
})

export const updateHealth = mutation({
  args: {
    id:     v.id("internAccounts"),
    health: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      health: Math.max(0, Math.min(100, args.health)),
    })
  }
})

export const addAchievement = mutation({
  args: {
    id:          v.id("internAccounts"),
    achievement: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.id)
    if (!account) throw new Error("Account not found")
    const achievements = account.achievements ?? []
    if (!achievements.includes(args.achievement)) {
      await ctx.db.patch(args.id, {
        achievements: [...achievements, args.achievement],
      })
    }
  }
})
