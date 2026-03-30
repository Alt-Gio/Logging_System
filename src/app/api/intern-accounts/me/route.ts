export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-fallback-secret-change-me-00000')
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('intern-session')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.role !== 'INTERN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const accountId = payload.id as string
    const internId  = payload.internId as string
    const convex    = getConvexClient()

    const [account, intern, activeSessions, tasks, notifications, allSessions] = await Promise.all([
      convex.query(api.internAccounts.getById, { id: accountId as Id<'internAccounts'> }),
      convex.query(api.interns.getById,        { id: internId  as Id<'interns'> }),
      convex.query(api.internSessions.getActiveSession, { internId: internId as Id<'interns'> }),
      convex.query(api.internTasks.getTasksForIntern,   { internId: internId as Id<'interns'> }),
      convex.query(api.notifications.getUnreadCount,    { recipientId: accountId }),
      convex.query(api.internSessions.getRecentSessions, { limit: 50 }),
    ])

    if (!account || !intern) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const totalXp    = account.xp
    let level = 1, remaining = totalXp
    while (remaining >= level * 100) { remaining -= level * 100; level++ }

    return NextResponse.json({
      account: {
        id:             account._id,
        level,
        xp:             account.xp,
        xpInLevel:      remaining,
        xpNeeded:       level * 100,
        health:         account.health,
        streak:         account.streak,
        achievements:   account.achievements,
        lastActiveDate: account.lastActiveDate,
      },
      intern: {
        id:               intern._id,
        fullName:         intern.fullName,
        school:           intern.school,
        course:           intern.course,
        department:       intern.department ?? null,
        photoUrl:         intern.photoUrl ?? null,
        totalHoursLogged: intern.totalHoursLogged ?? 0,
        requiredHours:    intern.requiredHours,
        status:           intern.status,
      },
      activeSession: activeSessions
        ? {
            id:      activeSessions._id,
            timeIn:  new Date(activeSessions.timeIn).toISOString(),
            status:  activeSessions.status,
          }
        : null,
      tasks: tasks.map((t: Record<string, unknown>) => ({
        id:          t._id,
        title:       t.title,
        description: t.description ?? null,
        status:      t.status,
        priority:    t.priority,
        difficulty:  t.difficulty ?? 'easy',
        xpReward:    t.xpReward ?? 10,
        type:        t.type ?? 'todo',
        dueDate:     t.dueDate ? new Date(t.dueDate as number).toISOString() : null,
        completedAt: t.completedAt ? new Date(t.completedAt as number).toISOString() : null,
      })),
      unreadNotifications: notifications,
      recentSessions: (allSessions as Record<string,unknown>[])
        .filter(s => s.internId === internId)
        .slice(0, 30)
        .map(s => ({
          id:            s._id,
          timeIn:        new Date(s.timeIn as number).toISOString(),
          timeOut:       s.timeOut ? new Date(s.timeOut as number).toISOString() : null,
          hoursLogged:   s.hoursLogged ?? null,
          status:        s.status,
          progressNote:  s.progressNote ?? null,
          checkInMethod: (s.checkInMethod as string) ?? 'direct',
        })),
    })
  } catch (e) {
    console.error('[intern-accounts/me]', e)
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 })
  }
}
