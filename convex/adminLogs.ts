import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query("adminLogs")
      .order("desc")
      .take(args.limit ?? 100)
  },
})

export const getByAdmin = query({
  args: { adminId: v.id("admins") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("adminLogs")
      .withIndex("by_adminId", q => q.eq("adminId", args.adminId))
      .order("desc")
      .collect()
  },
})

export const log = mutation({
  args: {
    adminId:   v.optional(v.id("admins")),
    action:    v.string(),
    target:    v.optional(v.string()),
    detail:    v.optional(v.string()),
    ip:        v.optional(v.string()),
    userEmail: v.optional(v.string()),
    userName:  v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("adminLogs", args)
  },
})
