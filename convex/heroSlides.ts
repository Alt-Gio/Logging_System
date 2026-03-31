import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"

const MAX_SLIDES = 5

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("heroSlides")
      .withIndex("by_active", q => q.eq("active", true))
      .collect()
      .then(slides => slides.sort((a, b) => a.order - b.order).slice(0, MAX_SLIDES))
  },
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("heroSlides")
      .withIndex("by_order")
      .order("asc")
      .collect()
  },
})

export const create = mutation({
  args: {
    title:       v.string(),
    description: v.optional(v.string()),
    mediaUrl:    v.string(),
    mediaType:   v.union(v.literal("image"), v.literal("video")),
    storageId:   v.optional(v.string()),
    order:       v.number(),
    active:      v.boolean(),
  },
  handler: async (ctx, args) => {
    const count = await ctx.db.query("heroSlides").collect().then(r => r.length)
    if (count >= MAX_SLIDES) throw new Error(`Maximum ${MAX_SLIDES} slides allowed`)
    return await ctx.db.insert("heroSlides", args)
  },
})

export const update = mutation({
  args: {
    id:          v.id("heroSlides"),
    title:       v.optional(v.string()),
    description: v.optional(v.string()),
    mediaUrl:    v.optional(v.string()),
    mediaType:   v.optional(v.union(v.literal("image"), v.literal("video"))),
    order:       v.optional(v.number()),
    active:      v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...patch }) => {
    await ctx.db.patch(id, patch)
  },
})

export const remove = mutation({
  args: { id: v.id("heroSlides") },
  handler: async (ctx, { id }) => {
    const slide = await ctx.db.get(id)
    if (slide?.storageId) {
      try { await ctx.storage.delete(slide.storageId as Id<"_storage">) } catch {}
    }
    await ctx.db.delete(id)
  },
})

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})

export const resolveStorageUrl = mutation({
  args: { storageId: v.string() },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId as Id<"_storage">)
  },
})
