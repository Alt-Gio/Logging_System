import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("settings")
      .withIndex("by_key", q => q.eq("key", args.key))
      .first()
  },
})

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("settings").collect()
  },
})

export const deleteByKey = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", q => q.eq("key", args.key))
      .first()
    if (existing) await ctx.db.delete(existing._id)
  },
})

export const set = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", q => q.eq("key", args.key))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value })
    } else {
      await ctx.db.insert("settings", { key: args.key, value: args.value })
    }
  },
})
