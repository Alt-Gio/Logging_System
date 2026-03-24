import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getForIntern = query({
  args: { internId: v.id("interns") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("internAttendance")
      .withIndex("by_internId", q => q.eq("internId", args.internId))
      .order("desc")
      .collect()
  },
})

export const create = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("internAttendance", args)
  },
})

export const update = mutation({
  args: {
    id:      v.id("internAttendance"),
    timeIn:  v.optional(v.number()),
    timeOut: v.optional(v.number()),
    hours:   v.optional(v.number()),
    status:  v.optional(v.union(
      v.literal("PRESENT"), v.literal("ABSENT"),
      v.literal("HALF_DAY"), v.literal("LEAVE"), v.literal("HOLIDAY"),
    )),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args
    await ctx.db.patch(id, patch)
  },
})

export const remove = mutation({
  args: { id: v.id("internAttendance") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
