import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

const TYPE_VALIDATOR = v.union(
  v.literal("INFO"), v.literal("WARNING"), v.literal("MAINTENANCE"), v.literal("HOLIDAY"),
)

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    return ctx.db
      .query("announcements")
      .withIndex("by_active", q => q.eq("active", true))
      .filter(q =>
        q.and(
          q.or(q.eq(q.field("dateStart"), undefined), q.lte(q.field("dateStart"), now)),
          q.or(q.eq(q.field("dateEnd"),   undefined), q.gte(q.field("dateEnd"),   now)),
          q.or(q.eq(q.field("expiresAt"), undefined), q.gt(q.field("expiresAt"),  now)),
        ),
      )
      .collect()
  },
})

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("announcements").order("desc").collect()
  },
})

export const create = mutation({
  args: {
    title:          v.string(),
    body:           v.string(),
    type:           TYPE_VALIDATOR,
    active:         v.boolean(),
    dateStart:      v.optional(v.number()),
    dateEnd:        v.optional(v.number()),
    expiresAt:      v.optional(v.number()),
    createdBy:      v.optional(v.string()),
    imageUrl:       v.optional(v.string()),
    imageStorageId: v.optional(v.string()),
    featured:       v.optional(v.boolean()),
    highlight:      v.optional(v.string()),
    featuredOrder:  v.optional(v.number()),
    tags:           v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("announcements", args)
  },
})

export const update = mutation({
  args: {
    id:             v.id("announcements"),
    title:          v.optional(v.string()),
    body:           v.optional(v.string()),
    active:         v.optional(v.boolean()),
    type:           v.optional(TYPE_VALIDATOR),
    dateStart:      v.optional(v.number()),
    dateEnd:        v.optional(v.number()),
    expiresAt:      v.optional(v.number()),
    imageUrl:       v.optional(v.string()),
    imageStorageId: v.optional(v.string()),
    featured:       v.optional(v.boolean()),
    highlight:      v.optional(v.string()),
    featuredOrder:  v.optional(v.number()),
    tags:           v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args
    await ctx.db.patch(id, patch)
  },
})

export const remove = mutation({
  args: { id: v.id("announcements") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})

export const generateImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})

export const resolveStorageUrl = mutation({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId as import("./_generated/dataModel").Id<"_storage">)
    if (!url) throw new Error("Storage file not found")
    return url
  },
})
