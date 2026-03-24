import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getRecent = query({
  args: { limit: v.optional(v.number()), archived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query("logEntries")
      .withIndex("by_timeIn")
      .order("desc")
      .filter(q => q.eq(q.field("archived"), args.archived ?? false))
      .take(args.limit ?? 100)
  },
})

export const getByDate = query({
  args: { dateFrom: v.number(), dateTo: v.number() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("logEntries")
      .withIndex("by_timeIn", q =>
        q.gte("timeIn", args.dateFrom).lte("timeIn", args.dateTo),
      )
      .order("desc")
      .collect()
  },
})

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("logEntries")
      .withIndex("by_timeOut_archived", q =>
        q.eq("timeOut", undefined).eq("archived", false),
      )
      .collect()
  },
})

export const getById = query({
  args: { id: v.id("logEntries") },
  handler: async (ctx, args) => ctx.db.get(args.id),
})

export const update = mutation({
  args: {
    id:                   v.id("logEntries"),
    fullName:             v.optional(v.string()),
    agency:               v.optional(v.string()),
    purpose:              v.optional(v.string()),
    equipmentUsed:        v.optional(v.array(v.string())),
    plannedDurationHours: v.optional(v.number()),
    serviceType:          v.optional(v.union(v.literal("SELF_SERVICE"), v.literal("STAFF_ASSISTED"))),
    staffNotes:           v.optional(v.string()),
    satisfactionRating:   v.optional(v.number()),
    photoUrl:             v.optional(v.string()),
    photoDataUrl:         v.optional(v.string()),
    timeIn:               v.optional(v.number()),
    timeOut:              v.optional(v.number()),
    archived:             v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args
    await ctx.db.patch(id, patch)
  },
})

export const create = mutation({
  args: {
    fullName:             v.string(),
    agency:               v.string(),
    purpose:              v.string(),
    equipmentUsed:        v.array(v.string()),
    date:                 v.number(),
    timeIn:               v.number(),
    plannedDurationHours: v.number(),
    serviceType:          v.union(v.literal("SELF_SERVICE"), v.literal("STAFF_ASSISTED")),
    photoDataUrl:         v.optional(v.string()),
    photoUrl:             v.optional(v.string()),
    staffNotes:           v.optional(v.string()),
    contactEmail:         v.optional(v.string()),
    contactPhone:         v.optional(v.string()),
    pcId:                 v.optional(v.id("pcs")),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("logEntries", { ...args, archived: false })
  },
})

export const timeOut = mutation({
  args: {
    id:                v.id("logEntries"),
    timeOut:           v.number(),
    satisfactionRating: v.optional(v.number()),
    staffNotes:        v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args
    await ctx.db.patch(id, patch)
  },
})

export const archive = mutation({
  args: { id: v.id("logEntries") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { archived: true })
  },
})

export const search = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("logEntries")
      .withSearchIndex("search_fullName", q =>
        q.search("fullName", args.searchTerm).eq("archived", false),
      )
      .take(50)
  },
})
