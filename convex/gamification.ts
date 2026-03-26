import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"

// ── XP / Level helpers ────────────────────────────────────────────────────────
export const XP_PER_DIFFICULTY: Record<string, number> = {
  trivial: 5,
  easy:    10,
  medium:  20,
  hard:    40,
  epic:    100,
}

function xpToNextLevel(level: number): number {
  return level * 100
}

function calcLevel(totalXp: number): { level: number; xpInLevel: number; xpNeeded: number } {
  let level = 1
  let remaining = totalXp
  while (remaining >= xpToNextLevel(level)) {
    remaining -= xpToNextLevel(level)
    level++
  }
  return { level, xpInLevel: remaining, xpNeeded: xpToNextLevel(level) }
}

export function levelTitle(level: number): string {
  if (level >= 21) return "DICT Legend"
  if (level >= 16) return "DTC Elite"
  if (level >= 11) return "ICT Champion"
  if (level >= 6)  return "Digital Advocate"
  return "OJT Beginner"
}

// ── Queries ───────────────────────────────────────────────────────────────────
export const getXpHistory = query({
  args: { accountId: v.id("internAccounts"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query("xpLedger")
      .withIndex("by_accountId", q => q.eq("accountId", args.accountId))
      .order("desc")
      .take(args.limit ?? 20)
  },
})

export const getStats = query({
  args: { accountId: v.id("internAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId)
    if (!account) return null
    const { level, xpInLevel, xpNeeded } = calcLevel(account.xp)
    const intern = await ctx.db.get(account.internId)
    const activeSessions = await ctx.db
      .query("internSessions")
      .withIndex("by_internId_status", q =>
        q.eq("internId", account.internId).eq("status", "ACTIVE"),
      )
      .first()
    return {
      ...account,
      level,
      xpInLevel,
      xpNeeded,
      title:         levelTitle(level),
      intern,
      activeSession: activeSessions ?? null,
    }
  },
})

// ── Mutations ─────────────────────────────────────────────────────────────────
export const awardXP = mutation({
  args: {
    accountId: v.id("internAccounts"),
    xp:        v.number(),
    reason:    v.string(),
    taskId:    v.optional(v.id("internTasks")),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId)
    if (!account) throw new Error("Account not found")

    const newXp = account.xp + args.xp
    const { level: newLevel } = calcLevel(newXp)
    const { level: oldLevel } = calcLevel(account.xp)
    const leveledUp = newLevel > oldLevel

    await ctx.db.patch(args.accountId, { xp: newXp, level: newLevel })

    await ctx.db.insert("xpLedger", {
      internId:  account.internId,
      accountId: args.accountId,
      xp:        args.xp,
      reason:    args.reason,
      taskId:    args.taskId,
      createdAt: Date.now(),
    })

    if (leveledUp) {
      await ctx.db.insert("notifications", {
        recipientId:   args.accountId,
        recipientType: "intern",
        title:         `🎉 Level Up! You're now Level ${newLevel}`,
        body:          `Congratulations! You reached ${levelTitle(newLevel)}. Keep it up!`,
        type:          "levelup",
        read:          false,
        createdAt:     Date.now(),
        link:          "/intern/dashboard",
      })
    }

    return { newXp, newLevel, leveledUp }
  },
})

export const checkAndAwardAchievements = mutation({
  args: { accountId: v.id("internAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId)
    if (!account) return

    const newBadges: string[] = []
    const existing = new Set(account.achievements)

    const intern = await ctx.db.get(account.internId)
    const completedTasks = intern?.completedTasks ?? 0

    const sessions = await ctx.db
      .query("internSessions")
      .withIndex("by_internId", q => q.eq("internId", account.internId))
      .take(100)
    const closedSessions = sessions.filter(s => s.status === "CLOSED")

    const BADGES = [
      { id: "first_timer",    check: () => closedSessions.length >= 1,   title: "First Timer" },
      { id: "task_master",    check: () => completedTasks >= 10,          title: "Task Master" },
      { id: "streak_keeper",  check: () => account.streak >= 7,           title: "Streak Keeper" },
      { id: "level_5",        check: () => account.level >= 5,            title: "Digital Advocate" },
      { id: "level_10",       check: () => account.level >= 10,           title: "ICT Champion" },
      { id: "level_20",       check: () => account.level >= 20,           title: "DICT Legend" },
      { id: "punctual",       check: () => account.streak >= 5,           title: "Punctual" },
    ]

    for (const badge of BADGES) {
      if (!existing.has(badge.id) && badge.check()) {
        newBadges.push(badge.id)
        await ctx.db.insert("notifications", {
          recipientId:   args.accountId,
          recipientType: "intern",
          title:         `🏆 Achievement: ${badge.title}`,
          body:          `You unlocked a new achievement badge!`,
          type:          "achievement",
          read:          false,
          createdAt:     Date.now(),
          link:          "/intern/dashboard",
        })
      }
    }

    if (newBadges.length > 0) {
      await ctx.db.patch(args.accountId, {
        achievements: [...account.achievements, ...newBadges],
      })
    }
    return newBadges
  },
})

export const updateStreak = mutation({
  args: { accountId: v.id("internAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId)
    if (!account) return

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const today = todayStart.getTime()

    const yesterdayStart = new Date(today - 86_400_000)
    const yesterday = yesterdayStart.getTime()

    const lastActive = account.lastActiveDate

    if (lastActive === today) return

    let newStreak = account.streak
    if (lastActive === yesterday) {
      newStreak = account.streak + 1
    } else if (!lastActive || lastActive < yesterday) {
      newStreak = 1
    }

    const xpBonus = Math.min(Math.floor(account.xp * 0.1 * Math.min(newStreak, 5)), 50)

    await ctx.db.patch(args.accountId, {
      streak:         newStreak,
      lastActiveDate: today,
    })

    if (newStreak > 1 && xpBonus > 0) {
      await ctx.db.insert("xpLedger", {
        internId:  account.internId,
        accountId: args.accountId,
        xp:        xpBonus,
        reason:    `streak_bonus_day_${newStreak}`,
        createdAt: Date.now(),
      })
      await ctx.db.patch(args.accountId, { xp: account.xp + xpBonus })
    }

    return { newStreak, xpBonus }
  },
})

export const applyHealthPenalty = mutation({
  args: {
    accountId: v.id("internAccounts"),
    penalty:   v.number(),
    reason:    v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId)
    if (!account) return
    const newHealth = Math.max(0, account.health - args.penalty)
    await ctx.db.patch(args.accountId, { health: newHealth })
    if (newHealth === 0 && account.health > 0) {
      await ctx.db.insert("notifications", {
        recipientId:   args.accountId,
        recipientType: "intern",
        title:         "⚠️ Your health is at 0!",
        body:          `Complete your daily habits and tasks to recover. Reason: ${args.reason}`,
        type:          "warning",
        read:          false,
        createdAt:     Date.now(),
        link:          "/intern/dashboard",
      })
      if (account.supervisorId) {
        await ctx.db.insert("notifications", {
          recipientId:   account.supervisorId,
          recipientType: "supervisor",
          title:         "⚠️ Intern health dropped to 0",
          body:          `An intern under your supervision needs attention.`,
          type:          "warning",
          read:          false,
          createdAt:     Date.now(),
          link:          "/supervisor/dashboard",
        })
      }
    }
    return { newHealth }
  },
})

export const recoverHealth = mutation({
  args: { accountId: v.id("internAccounts"), amount: v.number() },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId)
    if (!account) return
    const newHealth = Math.min(100, account.health + args.amount)
    await ctx.db.patch(args.accountId, { health: newHealth })
    return { newHealth }
  },
})
