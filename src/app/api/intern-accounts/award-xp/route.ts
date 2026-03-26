export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-fallback-secret-change-me-00000')
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('intern-session')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.role !== 'INTERN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const accountId = payload.id as string
    const { xp, reason, taskId } = await req.json()
    if (!xp || !reason) return NextResponse.json({ error: 'xp and reason required' }, { status: 400 })

    const convex = getConvexClient()
    const result = await convex.mutation(api.gamification.awardXP, {
      accountId: accountId as Id<'internAccounts'>,
      xp:        Number(xp),
      reason,
      taskId:    taskId ? taskId as Id<'internTasks'> : undefined,
    })

    // Check for new achievements
    await convex.mutation(api.gamification.checkAndAwardAchievements, {
      accountId: accountId as Id<'internAccounts'>,
    })

    // Update streak
    await convex.mutation(api.gamification.updateStreak, {
      accountId: accountId as Id<'internAccounts'>,
    })

    return NextResponse.json(result)
  } catch (e) {
    console.error('[award-xp]', e)
    return NextResponse.json({ error: 'Failed to award XP' }, { status: 500 })
  }
}
