export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-fallback-secret-change-me-00000')
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const token = req.cookies.get('supervisor-session')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.role !== 'SUPERVISOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const convex   = getConvexClient()
    const internId = params.id as Id<'interns'>

    const [intern, tasks, recentSessions] = await Promise.all([
      convex.query(api.interns.getById, { id: internId }),
      convex.query(api.internTasks.getTasksForIntern, { internId }),
      convex.query(api.internSessions.getSessionsForIntern, { internId }),
    ])

    if (!intern) return NextResponse.json({ error: 'Intern not found' }, { status: 404 })

    const account = await convex.query(api.internAccounts.getByInternId, { internId })

    return NextResponse.json({
      id:               intern._id,
      fullName:         intern.fullName,
      school:           intern.school,
      course:           intern.course,
      department:       intern.department ?? null,
      photoUrl:         intern.photoUrl ?? null,
      totalHoursLogged: intern.totalHoursLogged ?? 0,
      requiredHours:    intern.requiredHours,
      status:           intern.status,
      completedTasks:   intern.completedTasks ?? 0,
      account: account ? {
        id:           account._id,
        level:        account.level ?? 1,
        xp:           account.xp ?? 0,
        health:       account.health ?? 100,
        streak:       account.streak ?? 0,
        achievements: account.achievements ?? [],
      } : null,
      tasks: (tasks as Array<Record<string, unknown>>).map(t => ({
        id:          t._id,
        title:       t.title,
        status:      t.status,
        priority:    t.priority,
        difficulty:  t.difficulty ?? 'easy',
        xpReward:    t.xpReward ?? 10,
        dueDate:     t.dueDate ? new Date(t.dueDate as number).toISOString() : null,
        completedAt: t.completedAt ? new Date(t.completedAt as number).toISOString() : null,
      })),
      recentSessions: (recentSessions as Array<Record<string, unknown>>).map(s => ({
        id:           s._id,
        timeIn:       new Date(s.timeIn as number).toISOString(),
        timeOut:      s.timeOut ? new Date(s.timeOut as number).toISOString() : null,
        hoursLogged:  s.hoursLogged ?? null,
        progressNote: s.progressNote ?? null,
      })),
    })
  } catch (e) {
    console.error('[supervisor/intern/[id] GET]', e)
    return NextResponse.json({ error: 'Failed to load intern details' }, { status: 500 })
  }
}
