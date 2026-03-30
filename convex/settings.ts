import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { Id } from "./_generated/dataModel"

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

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})

export const saveMediaUrl = mutation({
  args: {
    storageId: v.id("_storage"),
    mediaType: v.union(v.literal("image"), v.literal("video")),
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId)
    if (!url) throw new Error("Failed to get storage URL")

    const upsert = async (key: string, value: string) => {
      const existing = await ctx.db
        .query("settings")
        .withIndex("by_key", q => q.eq("key", key))
        .first()
      if (existing) await ctx.db.patch(existing._id, { value })
      else await ctx.db.insert("settings", { key, value })
    }

    await upsert("hero_media_url",  url)
    await upsert("hero_media_type", args.mediaType)
    await upsert("hero_media_storage_id", args.storageId as unknown as string)

    return url
  },
})
