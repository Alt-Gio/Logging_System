import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

const cameraType = v.union(
  v.literal("MJPEG"), v.literal("SNAPSHOT"),
  v.literal("HLS"),   v.literal("RTSP_PROXY"),
)

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("cameras").withIndex("by_sortOrder").order("asc").collect()
  },
})

export const getById = query({
  args: { id: v.id("cameras") },
  handler: async (ctx, args) => ctx.db.get(args.id),
})

export const create = mutation({
  args: {
    name:      v.string(),
    url:       v.string(),
    type:      cameraType,
    notes:     v.optional(v.string()),
    enabled:   v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const count = (await ctx.db.query("cameras").collect()).length
    return ctx.db.insert("cameras", {
      name:      args.name,
      url:       args.url,
      type:      args.type,
      notes:     args.notes,
      enabled:   args.enabled ?? true,
      sortOrder: args.sortOrder ?? count,
    })
  },
})

export const update = mutation({
  args: {
    id:      v.id("cameras"),
    name:    v.optional(v.string()),
    url:     v.optional(v.string()),
    type:    v.optional(cameraType),
    notes:   v.optional(v.string()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args
    await ctx.db.patch(id, patch)
  },
})

export const remove = mutation({
  args: { id: v.id("cameras") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
