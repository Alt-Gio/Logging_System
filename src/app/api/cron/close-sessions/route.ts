import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-cron-secret')
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const convex  = getConvexClient()
    const result  = await convex.mutation(api.internSessions.closeSessions, {})
    return NextResponse.json(result)
  } catch (e) {
    console.error('[cron/close-sessions]', e)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
