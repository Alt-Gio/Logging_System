import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getActiveCount = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("interns")
      .withIndex("by_status", q => q.eq("status", "ACTIVE"))
      .collect()
    return active.length
  },
})

export const getAll = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.status) {
      return ctx.db
        .query("interns")
        .withIndex("by_status", q => q.eq("status", args.status as "ACTIVE" | "COMPLETED" | "INACTIVE" | "ON_LEAVE"))
        .collect()
    }
    return ctx.db.query("interns").collect()
  },
})

export const getById = query({
  args: { id: v.id("interns") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id)
  },
})

export const search = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("interns")
      .withSearchIndex("search_fullName", q => q.search("fullName", args.searchTerm))
      .take(20)
  },
})

export const create = mutation({
  args: {
    fullName:              v.string(),
    school:                v.string(),
    schoolId:              v.optional(v.id("schools")),
    course:                v.string(),
    department:            v.optional(v.string()),
    supervisor:            v.optional(v.string()),
    startDate:             v.number(),
    endDate:               v.number(),
    requiredHours:         v.number(),
    status:                v.union(v.literal("ACTIVE"), v.literal("COMPLETED"), v.literal("INACTIVE"), v.literal("ON_LEAVE")),
    email:                 v.optional(v.string()),
    phone:                 v.optional(v.string()),
    photoUrl:              v.optional(v.string()),
    photoStorageId:        v.optional(v.string()),
    notes:                 v.optional(v.string()),
    sex:                   v.optional(v.union(v.literal("M"), v.literal("F"))),
    age:                   v.optional(v.number()),
    civilStatus:           v.optional(v.string()),
    isIndigenous:          v.optional(v.boolean()),
    isPWD:                 v.optional(v.boolean()),
    isSoloParent:          v.optional(v.boolean()),
    officeAssignment:      v.optional(v.string()),
    onboardingDate:        v.optional(v.number()),
    estimatedCompletion:   v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("interns", { ...args, totalHoursLogged: 0, completedTasks: 0 })
  },
})

export const update = mutation({
  args: {
    id:                    v.id("interns"),
    fullName:              v.optional(v.string()),
    school:                v.optional(v.string()),
    schoolId:              v.optional(v.id("schools")),
    course:                v.optional(v.string()),
    department:            v.optional(v.string()),
    supervisor:            v.optional(v.string()),
    startDate:             v.optional(v.number()),
    endDate:               v.optional(v.number()),
    requiredHours:         v.optional(v.number()),
    status:                v.optional(v.union(v.literal("ACTIVE"), v.literal("COMPLETED"), v.literal("INACTIVE"), v.literal("ON_LEAVE"))),
    email:                 v.optional(v.string()),
    phone:                 v.optional(v.string()),
    photoUrl:              v.optional(v.string()),
    photoStorageId:        v.optional(v.string()),
    notes:                 v.optional(v.string()),
    sex:                   v.optional(v.union(v.literal("M"), v.literal("F"))),
    age:                   v.optional(v.number()),
    civilStatus:           v.optional(v.string()),
    isIndigenous:          v.optional(v.boolean()),
    isPWD:                 v.optional(v.boolean()),
    isSoloParent:          v.optional(v.boolean()),
    officeAssignment:      v.optional(v.string()),
    onboardingDate:        v.optional(v.number()),
    estimatedCompletion:   v.optional(v.number()),
    completionDate:        v.optional(v.number()),
    isCompleted:           v.optional(v.boolean()),
    totalHoursLogged:      v.optional(v.number()),
    doc2x2StorageId:       v.optional(v.string()),
    docResumeStorageId:    v.optional(v.string()),
    docApplicationStorageId: v.optional(v.string()),
    docEndorsementStorageId: v.optional(v.string()),
    docMedicalStorageId:   v.optional(v.string()),
    docWfhStorageId:       v.optional(v.string()),
    docWorkPlanStorageId:  v.optional(v.string()),
    docNdaStorageId:       v.optional(v.string()),
    docNotesStorageId:     v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args
    await ctx.db.patch(id, patch)
  },
})

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
})

export const resolveUrl = mutation({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    return ctx.storage.getUrl(args.storageId as import("./_generated/dataModel").Id<"_storage">)
  },
})

export const remove = mutation({
  args: { id: v.id("interns") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
