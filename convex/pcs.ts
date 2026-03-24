import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("pcs").collect()
  },
})

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("pcs")
      .withIndex("by_isActive", q => q.eq("isActive", true))
      .collect()
  },
})

export const getById = query({
  args: { id: v.id("pcs") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id)
  },
})

export const create = mutation({
  args: {
    name:       v.string(),
    ipAddress:  v.string(),
    macAddress: v.optional(v.string()),
    location:   v.optional(v.string()),
    isActive:   v.boolean(),
    status:     v.union(v.literal("ONLINE"), v.literal("OFFLINE"), v.literal("IN_USE"), v.literal("MAINTENANCE")),
    ssid:       v.optional(v.string()),
    specs:      v.optional(v.string()),
    icon:       v.optional(v.string()),
    gridCol:    v.optional(v.number()),
    gridRow:    v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("pcs", args)
  },
})

export const updateStatus = mutation({
  args: {
    id:      v.id("pcs"),
    status:  v.union(v.literal("ONLINE"), v.literal("OFFLINE"), v.literal("IN_USE"), v.literal("MAINTENANCE")),
    lastSeen: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args
    await ctx.db.patch(id, patch)
  },
})

export const update = mutation({
  args: {
    id:         v.id("pcs"),
    name:       v.optional(v.string()),
    ipAddress:  v.optional(v.string()),
    macAddress: v.optional(v.string()),
    location:   v.optional(v.string()),
    isActive:   v.optional(v.boolean()),
    ssid:       v.optional(v.string()),
    specs:      v.optional(v.string()),
    icon:       v.optional(v.string()),
    gridCol:    v.optional(v.number()),
    gridRow:    v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args
    await ctx.db.patch(id, patch)
  },
})

export const remove = mutation({
  args: { id: v.id("pcs") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
