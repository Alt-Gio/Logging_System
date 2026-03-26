export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export async function GET(req: NextRequest) {
  try {
    const supervisorId = req.nextUrl.searchParams.get('supervisorId')
    const convex = getConvexClient()
    const board = await convex.query(api.internAccounts.getLeaderboard, {
      supervisorId: supervisorId ? supervisorId as Id<'supervisors'> : undefined,
    })
    return NextResponse.json(board)
  } catch (e) {
    console.error('[leaderboard]', e)
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 })
  }
}
