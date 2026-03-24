import { internalMutation, mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getRecentByContact = query({
  args: { contact: v.string(), since: v.number() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("otpVerifications")
      .withIndex("by_contact", q => q.eq("contact", args.contact))
      .filter(q => q.gte(q.field("_creationTime"), args.since))
      .collect()
  },
})

export const create = mutation({
  args: {
    contact:     v.string(),
    contactType: v.string(),
    otpCode:     v.string(),
    purpose:     v.string(),
    expiresAt:   v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("otpVerifications", { ...args, verified: false })
  },
})

export const verify = mutation({
  args: { contact: v.string(), otpCode: v.string() },
  handler: async (ctx, args) => {
    const otp = await ctx.db
      .query("otpVerifications")
      .withIndex("by_contact", q => q.eq("contact", args.contact))
      .filter(q => q.eq(q.field("otpCode"), args.otpCode))
      .first()
    if (!otp) return { success: false, reason: "not_found" }
    if (otp.verified) return { success: false, reason: "already_used" }
    if (Date.now() > otp.expiresAt) return { success: false, reason: "expired" }
    await ctx.db.patch(otp._id, { verified: true })
    return { success: true }
  },
})

export const cleanExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now     = Date.now()
    const expired = await ctx.db
      .query("otpVerifications")
      .withIndex("by_expiresAt", q => q.lt("expiresAt", now))
      .collect()
    for (const otp of expired) {
      await ctx.db.delete(otp._id)
    }
    return { deleted: expired.length }
  },
})
