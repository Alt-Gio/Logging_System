import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getAll = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.status) {
      return ctx.db
        .query("interns")
        .withIndex("by_status", q => q.eq("status", args.status as "ACTIVE" | "COMPLETED" | "INACTIVE" | "ON_LEAVE"))
        .collect()
    }
    return ctx.db.query("interns").collect()
  },
})

export const getById = query({
  args: { id: v.id("interns") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id)
  },
})

export const search = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("interns")
      .withSearchIndex("search_fullName", q => q.search("fullName", args.searchTerm))
      .take(20)
  },
})

export const create = mutation({
  args: {
    fullName:      v.string(),
    school:        v.string(),
    course:        v.string(),
    department:    v.optional(v.string()),
    supervisor:    v.optional(v.string()),
    startDate:     v.number(),
    endDate:       v.number(),
    requiredHours: v.number(),
    status:        v.union(v.literal("ACTIVE"), v.literal("COMPLETED"), v.literal("INACTIVE"), v.literal("ON_LEAVE")),
    email:         v.optional(v.string()),
    phone:         v.optional(v.string()),
    photoUrl:      v.optional(v.string()),
    notes:         v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("interns", { ...args, totalHoursLogged: 0, completedTasks: 0 })
  },
})

export const update = mutation({
  args: {
    id:            v.id("interns"),
    fullName:      v.optional(v.string()),
    school:        v.optional(v.string()),
    course:        v.optional(v.string()),
    department:    v.optional(v.string()),
    supervisor:    v.optional(v.string()),
    startDate:     v.optional(v.number()),
    endDate:       v.optional(v.number()),
    requiredHours: v.optional(v.number()),
    status:        v.optional(v.union(v.literal("ACTIVE"), v.literal("COMPLETED"), v.literal("INACTIVE"), v.literal("ON_LEAVE"))),
    email:         v.optional(v.string()),
    phone:         v.optional(v.string()),
    photoUrl:      v.optional(v.string()),
    notes:         v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args
    await ctx.db.patch(id, patch)
  },
})

export const remove = mutation({
  args: { id: v.id("interns") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
