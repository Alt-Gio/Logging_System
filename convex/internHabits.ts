import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getForSupervisor = query({
  args: { supervisorId: v.id("supervisors") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("internHabits")
      .withIndex("by_supervisorId", q => q.eq("supervisorId", args.supervisorId))
      .take(50)
  },
})

export const getForIntern = query({
  args: { internId: v.id("interns"), supervisorId: v.optional(v.id("supervisors")) },
  handler: async (ctx, args) => {
    const personal = await ctx.db
      .query("internHabits")
      .withIndex("by_targetInternId", q => q.eq("targetInternId", args.internId))
      .take(20)
    const group = args.supervisorId
      ? await ctx.db
          .query("internHabits")
          .withIndex("by_supervisorId", q => q.eq("supervisorId", args.supervisorId))
          .filter(q => q.eq(q.field("targetInternId"), undefined))
          .take(20)
      : []
    return [...personal, ...group].filter(h => h.active)
  },
})

export const getTodayLogsForIntern = query({
  args: { internId: v.id("interns") },
  handler: async (ctx, args) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return ctx.db
      .query("internHabitLogs")
      .withIndex("by_internId_date", q =>
        q.eq("internId", args.internId).eq("date", today.getTime()),
      )
      .take(50)
  },
})

export const create = mutation({
  args: {
    title:          v.string(),
    description:    v.optional(v.string()),
    difficulty:     v.union(
      v.literal("trivial"), v.literal("easy"),
      v.literal("medium"),  v.literal("hard"), v.literal("epic"),
    ),
    frequency:      v.union(v.literal("daily"), v.literal("weekly")),
    positive:       v.boolean(),
    xpReward:       v.number(),
    supervisorId:   v.optional(v.id("supervisors")),
    targetInternId: v.optional(v.id("interns")),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("internHabits", { ...args, active: true })
  },
})

export const complete = mutation({
  args: {
    habitId:  v.id("internHabits"),
    internId: v.id("interns"),
  },
  handler: async (ctx, args) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const date = today.getTime()

    const existing = await ctx.db
      .query("internHabitLogs")
      .withIndex("by_habitId_internId_date", q =>
        q.eq("habitId", args.habitId).eq("internId", args.internId).eq("date", date),
      )
      .unique()

    if (existing?.completed) throw new Error("Already completed today")

    if (existing) {
      await ctx.db.patch(existing._id, { completed: true, completedAt: Date.now() })
    } else {
      await ctx.db.insert("internHabitLogs", {
        habitId:     args.habitId,
        internId:    args.internId,
        date,
        completed:   true,
        completedAt: Date.now(),
      })
    }

    const habit = await ctx.db.get(args.habitId)
    return { xpReward: habit?.xpReward ?? 10 }
  },
})

export const deactivate = mutation({
  args: { id: v.id("internHabits") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { active: false })
  },
})
