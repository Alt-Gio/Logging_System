import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getTasksForIntern = query({
  args: { internId: v.id("interns") },
  handler: async (ctx, args) => {
    const personal = await ctx.db
      .query("internTasks")
      .withIndex("by_internId", q => q.eq("internId", args.internId))
      .collect()
    const global = await ctx.db
      .query("internTasks")
      .withIndex("by_internId", q => q.eq("internId", undefined))
      .collect()
    return [...personal, ...global].sort((a, b) =>
      a._creationTime > b._creationTime ? -1 : 1,
    )
  },
})

export const getAllTasks = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("internTasks").order("desc").collect()
  },
})

export const updateTaskStatus = mutation({
  args: {
    taskId: v.id("internTasks"),
    status: v.union(
      v.literal("PENDING"), v.literal("IN_PROGRESS"),
      v.literal("COMPLETED"), v.literal("CANCELLED"),
    ),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId)
    if (!task) throw new Error("Task not found")
    await ctx.db.patch(args.taskId, {
      status:      args.status,
      completedAt: args.status === "COMPLETED" ? Date.now() : undefined,
    })
    if (task.internId && args.status === "COMPLETED") {
      const intern = await ctx.db.get(task.internId)
      if (intern) {
        await ctx.db.patch(task.internId, {
          completedTasks: (intern.completedTasks ?? 0) + 1,
        })
      }
    }
  },
})

export const createTask = mutation({
  args: {
    internId:    v.optional(v.id("interns")),
    title:       v.string(),
    description: v.optional(v.string()),
    priority:    v.union(v.literal("LOW"), v.literal("MEDIUM"), v.literal("HIGH"), v.literal("URGENT")),
    dueDate:     v.optional(v.number()),
    createdBy:   v.optional(v.id("admins")),
    taskId:      v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("internTasks", { ...args, status: "PENDING" })
  },
})

export const deleteTask = mutation({
  args: { taskId: v.id("internTasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.taskId)
  },
})
