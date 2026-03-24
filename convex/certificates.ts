import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getAllTemplates = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("certificateTemplates").order("desc").collect()
  },
})

export const getTemplateById = query({
  args: { id: v.id("certificateTemplates") },
  handler: async (ctx, args) => ctx.db.get(args.id),
})

export const createTemplate = mutation({
  args: {
    name:          v.string(),
    description:   v.optional(v.string()),
    backgroundUrl: v.optional(v.string()),
    width:         v.number(),
    height:        v.number(),
    fields:        v.any(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("certificateTemplates", args)
  },
})

export const updateTemplate = mutation({
  args: {
    id:            v.id("certificateTemplates"),
    name:          v.optional(v.string()),
    description:   v.optional(v.string()),
    backgroundUrl: v.optional(v.string()),
    width:         v.optional(v.number()),
    height:        v.optional(v.number()),
    fields:        v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args
    await ctx.db.patch(id, patch)
  },
})

export const deleteTemplate = mutation({
  args: { id: v.id("certificateTemplates") },
  handler: async (ctx, args) => {
    const certs = await ctx.db
      .query("certificates")
      .withIndex("by_templateId", q => q.eq("templateId", args.id))
      .collect()
    for (const c of certs) await ctx.db.delete(c._id)
    await ctx.db.delete(args.id)
  },
})

export const issue = mutation({
  args: {
    templateId: v.id("certificateTemplates"),
    internId:   v.optional(v.id("interns")),
    data:       v.any(),
    pdfUrl:     v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("certificates", { ...args, issuedAt: Date.now() })
  },
})

export const getByIntern = query({
  args: { internId: v.id("interns") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("certificates")
      .withIndex("by_internId", q => q.eq("internId", args.internId))
      .collect()
  },
})

export const countByTemplate = query({
  args: { templateId: v.id("certificateTemplates") },
  handler: async (ctx, args) => {
    const list = await ctx.db
      .query("certificates")
      .withIndex("by_templateId", q => q.eq("templateId", args.templateId))
      .collect()
    return list.length
  },
})
