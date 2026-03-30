import { mutation, query, internalMutation } from "./_generated/server"
import { v } from "convex/values"

export const getActiveSession = query({
  args: { internId: v.id("interns") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("internSessions")
      .withIndex("by_internId_status", q =>
        q.eq("internId", args.internId).eq("status", "ACTIVE"),
      )
      .first()
  },
})

export const getAllActiveSessions = query({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db
      .query("internSessions")
      .withIndex("by_status", q => q.eq("status", "ACTIVE"))
      .collect()
    return Promise.all(
      sessions.map(async session => {
        const intern = await ctx.db.get(session.internId)
        return { ...session, internName: intern?.fullName, internPhoto: intern?.photoUrl }
      }),
    )
  },
})

export const getRecentSessions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("internSessions")
      .withIndex("by_timeIn")
      .order("desc")
      .take(args.limit ?? 50)
    return Promise.all(
      sessions.map(async s => {
        const intern = await ctx.db.get(s.internId)
        return { ...s, internName: intern?.fullName }
      }),
    )
  },
})

export const getSessionsForIntern = query({
  args: { internId: v.id("interns") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("internSessions")
      .withIndex("by_internId", q => q.eq("internId", args.internId))
      .order("desc")
      .collect()
  },
})

export const timeIn = mutation({
  args: {
    internId:      v.id("interns"),
    checkInMethod: v.optional(v.union(v.literal("direct"), v.literal("qr"), v.literal("qr_location"))),
    checkInLat:    v.optional(v.number()),
    checkInLng:    v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("internSessions")
      .withIndex("by_internId_status", q =>
        q.eq("internId", args.internId).eq("status", "ACTIVE"),
      )
      .first()
    if (existing) throw new Error("Session already active")

    const sessionId = await ctx.db.insert("internSessions", {
      internId:      args.internId,
      timeIn:        Date.now(),
      status:        "ACTIVE",
      checkInMethod: args.checkInMethod ?? "direct",
      checkInLat:    args.checkInLat,
      checkInLng:    args.checkInLng,
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const existingAtt = await ctx.db
      .query("internAttendance")
      .withIndex("by_internId_date", q =>
        q.eq("internId", args.internId).eq("date", today.getTime()),
      )
      .first()
    if (!existingAtt) {
      await ctx.db.insert("internAttendance", {
        internId: args.internId,
        date:     today.getTime(),
        timeIn:   Date.now(),
        status:   "PRESENT",
      })
    }
    return sessionId
  },
})

export const timeOut = mutation({
  args: {
    sessionId:    v.id("internSessions"),
    progressNote: v.string(),
    closedBy:     v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session)                    throw new Error("Session not found")
    if (session.status === "CLOSED") throw new Error("Session already closed")
    if (!args.progressNote.trim())   throw new Error("Progress note is required")

    const now          = Date.now()
    const hoursLogged  = (now - session.timeIn) / 3_600_000

    await ctx.db.patch(args.sessionId, {
      timeOut:      now,
      status:       "CLOSED",
      progressNote: args.progressNote,
      closedBy:     args.closedBy ?? "intern",
      hoursLogged:  Math.round(hoursLogged * 100) / 100,
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const att = await ctx.db
      .query("internAttendance")
      .withIndex("by_internId_date", q =>
        q.eq("internId", session.internId).eq("date", today.getTime()),
      )
      .first()
    if (att) {
      await ctx.db.patch(att._id, {
        timeOut: now,
        hours:   Math.round(hoursLogged * 100) / 100,
        status:  hoursLogged < 4 ? "HALF_DAY" : "PRESENT",
      })
    }

    const intern = await ctx.db.get(session.internId)
    if (intern) {
      await ctx.db.patch(session.internId, {
        totalHoursLogged: (intern.totalHoursLogged ?? 0) + hoursLogged,
      })
    }

    return { hoursLogged: Math.round(hoursLogged * 100) / 100 }
  },
})

export const closeSessions = mutation({
  args: { secret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const active = await ctx.db
      .query("internSessions")
      .withIndex("by_status", q => q.eq("status", "ACTIVE"))
      .collect()
    for (const s of active) {
      const now         = Date.now()
      const hoursLogged = (now - s.timeIn) / 3_600_000
      await ctx.db.patch(s._id, {
        timeOut:      now,
        status:       "CLOSED",
        progressNote: "Auto-closed at 5:00 PM by system",
        closedBy:     "system",
        hoursLogged:  Math.round(hoursLogged * 100) / 100,
      })
      const intern = await ctx.db.get(s.internId)
      if (intern) {
        await ctx.db.patch(s.internId, {
          totalHoursLogged: (intern.totalHoursLogged ?? 0) + hoursLogged,
        })
      }
    }
    return { closed: active.length }
  },
})

export const autoCloseAllSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("internSessions")
      .withIndex("by_status", q => q.eq("status", "ACTIVE"))
      .collect()
    for (const s of active) {
      const now         = Date.now()
      const hoursLogged = (now - s.timeIn) / 3_600_000
      await ctx.db.patch(s._id, {
        timeOut:      now,
        status:       "CLOSED",
        progressNote: "Auto-closed at 5:00 PM by system",
        closedBy:     "system",
        hoursLogged:  Math.round(hoursLogged * 100) / 100,
      })
    }
    return { closed: active.length }
  },
})
