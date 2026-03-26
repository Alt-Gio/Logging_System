import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getForRecipient = query({
  args: {
    recipientId: v.string(),
    limit:       v.optional(v.number()),
    unreadOnly:  v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.unreadOnly) {
      return ctx.db
        .query("notifications")
        .withIndex("by_recipientId_read", q =>
          q.eq("recipientId", args.recipientId).eq("read", false),
        )
        .order("desc")
        .take(args.limit ?? 20)
    }
    return ctx.db
      .query("notifications")
      .withIndex("by_recipientId", q => q.eq("recipientId", args.recipientId))
      .order("desc")
      .take(args.limit ?? 30)
  },
})

export const getUnreadCount = query({
  args: { recipientId: v.string() },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_recipientId_read", q =>
        q.eq("recipientId", args.recipientId).eq("read", false),
      )
      .take(50)
    return unread.length
  },
})

export const create = mutation({
  args: {
    recipientId:   v.string(),
    recipientType: v.union(
      v.literal("intern"), v.literal("supervisor"), v.literal("admin"),
    ),
    title:   v.string(),
    body:    v.string(),
    type:    v.union(
      v.literal("task"),         v.literal("timein"),
      v.literal("timeout"),      v.literal("xp"),
      v.literal("announcement"), v.literal("warning"),
      v.literal("achievement"),  v.literal("levelup"),
    ),
    link: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("notifications", {
      ...args,
      read:      false,
      createdAt: Date.now(),
    })
  },
})

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { read: true })
  },
})

export const markAllRead = mutation({
  args: { recipientId: v.string() },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_recipientId_read", q =>
        q.eq("recipientId", args.recipientId).eq("read", false),
      )
      .take(100)
    await Promise.all(unread.map(n => ctx.db.patch(n._id, { read: true })))
    return { marked: unread.length }
  },
})
