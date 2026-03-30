import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("schools").order("asc").collect()
  },
})

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("schools").withIndex("by_active", q => q.eq("active", true)).collect()
  },
})

export const getById = query({
  args: { id: v.id("schools") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id)
  },
})

export const create = mutation({
  args: {
    name:                 v.string(),
    type:                 v.optional(v.string()),
    address:              v.optional(v.string()),
    email:                v.optional(v.string()),
    practicumCoordinator: v.optional(v.string()),
    coordinatorEmail:     v.optional(v.string()),
    coordinatorPhone:     v.optional(v.string()),
    active:               v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("schools", { ...args, active: args.active ?? true })
  },
})

export const update = mutation({
  args: {
    id:                   v.id("schools"),
    name:                 v.optional(v.string()),
    type:                 v.optional(v.string()),
    address:              v.optional(v.string()),
    email:                v.optional(v.string()),
    practicumCoordinator: v.optional(v.string()),
    coordinatorEmail:     v.optional(v.string()),
    coordinatorPhone:     v.optional(v.string()),
    active:               v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args
    await ctx.db.patch(id, patch)
  },
})

export const remove = mutation({
  args: { id: v.id("schools") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
