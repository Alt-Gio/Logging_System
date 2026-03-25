import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("admins")
      .withIndex("by_username", q => q.eq("username", args.username))
      .first()
  },
})

export const getById = query({
  args: { id: v.id("admins") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id)
  },
})

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("admins")
      .collect()
      .then(rows => rows.map(r => ({ id: r._id, username: r.username, name: r.name, role: r.role, lastLoginAt: r.lastLoginAt })))
  },
})

export const create = mutation({
  args: {
    username:     v.string(),
    passwordHash: v.string(),
    name:         v.string(),
    role:         v.union(v.literal("SUPER_ADMIN"), v.literal("ADMIN"), v.literal("STAFF")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("admins")
      .withIndex("by_username", q => q.eq("username", args.username))
      .first()
    if (existing) throw new Error("Username already exists")
    return ctx.db.insert("admins", args)
  },
})

export const updateLastLogin = mutation({
  args: { id: v.id("admins") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { lastLoginAt: Date.now() })
  },
})

export const update = mutation({
  args: {
    id:   v.id("admins"),
    name: v.optional(v.string()),
    role: v.optional(v.union(v.literal("SUPER_ADMIN"), v.literal("ADMIN"), v.literal("STAFF"))),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args
    await ctx.db.patch(id, patch)
  },
})

export const updatePassword = mutation({
  args: { id: v.id("admins"), passwordHash: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { passwordHash: args.passwordHash })
  },
})

export const remove = mutation({
  args: { id: v.id("admins") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})

export const createOrUpdate = mutation({
  args: {
    username:     v.string(),
    passwordHash: v.string(),
    name:         v.string(),
    role:         v.union(v.literal("SUPER_ADMIN"), v.literal("ADMIN"), v.literal("STAFF")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("admins")
      .withIndex("by_username", q => q.eq("username", args.username))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, {
        passwordHash: args.passwordHash,
        name:         args.name,
        role:         args.role,
      })
      return existing._id
    }
    return ctx.db.insert("admins", args)
  },
})
