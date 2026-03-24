import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getForIntern = query({
  args: { internId: v.id("interns") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("internDocuments")
      .withIndex("by_internId", q => q.eq("internId", args.internId))
      .order("desc")
      .collect()
  },
})

export const create = mutation({
  args: {
    internId:   v.id("interns"),
    name:       v.string(),
    type:       v.string(),
    url:        v.string(),
    uploadedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("internDocuments", args)
  },
})

export const remove = mutation({
  args: { id: v.id("internDocuments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
