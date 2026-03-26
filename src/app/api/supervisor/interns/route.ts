export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-fallback-secret-change-me-00000')
}

function calcXpInLevel(totalXp: number): { level: number; xpInLevel: number; xpNeeded: number } {
  let level = 1, remaining = totalXp
  while (remaining >= level * 100) { remaining -= level * 100; level++ }
  return { level, xpInLevel: remaining, xpNeeded: level * 100 }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('supervisor-session')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.role !== 'SUPERVISOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const supervisorId = payload.id as string
    const convex = getConvexClient()

    const myInterns = await convex.query(api.supervisors.getMyInterns, {
      supervisorId: supervisorId as Id<'supervisors'>,
    })

    const enriched = await Promise.all(
      (myInterns as Array<Record<string, unknown>>).map(async (entry) => {
        const intern = entry as Record<string, unknown>
        const account = intern.account as Record<string, unknown> | undefined
        const internId = intern._id as string

        const [activeSessions, tasks] = await Promise.all([
          convex.query(api.internSessions.getActiveSession, { internId: internId as Id<'interns'> }),
          convex.query(api.internTasks.getTasksForIntern,   { internId: internId as Id<'interns'> }),
        ])

        const completedTasks = (tasks as Array<{status: string}>).filter(t => t.status === 'COMPLETED').length

        return {
          id:               internId,
          fullName:         intern.fullName,
          school:           intern.school,
          course:           intern.course,
          photoUrl:         intern.photoUrl ?? null,
          status:           intern.status,
          totalHoursLogged: intern.totalHoursLogged ?? 0,
          requiredHours:    intern.requiredHours,
          account: account ? {
            id:           account._id,
            level:        account.level ?? 1,
            xp:           account.xp ?? 0,
            health:       account.health ?? 100,
            streak:       account.streak ?? 0,
            achievements: account.achievements ?? [],
          } : null,
          activeSession: activeSessions
            ? { id: (activeSessions as Record<string, unknown>)._id, timeIn: new Date((activeSessions as Record<string, unknown>).timeIn as number).toISOString() }
            : null,
          pendingTasks:   (tasks as Array<{status: string}>).filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length,
          completedTasks,
          totalTasks:     tasks.length,
        }
      }),
    )

    return NextResponse.json(enriched)
  } catch (e) {
    console.error('[supervisor/interns GET]', e)
    return NextResponse.json({ error: 'Failed to fetch interns' }, { status: 500 })
  }
}
