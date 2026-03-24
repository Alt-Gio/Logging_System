import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const internId = searchParams.get('internId')
    const convex = getConvexClient()

    if (!internId) {
      const sessions = await convex.query(api.internSessions.getAllActiveSessions)
      return NextResponse.json(sessions)
    }

    const session = await convex.query(api.internSessions.getActiveSession, {
      internId: internId as Id<'interns'>,
    })
    return NextResponse.json(session ?? null)
  } catch (e) {
    console.error('[intern-sessions GET]', e)
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { internId } = await req.json()
    if (!internId) return NextResponse.json({ error: 'internId required' }, { status: 400 })

    const convex = getConvexClient()
    const sessionId = await convex.mutation(api.internSessions.timeIn, {
      internId: internId as Id<'interns'>,
    })
    return NextResponse.json({ _id: sessionId }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('already active')) return NextResponse.json({ error: msg }, { status: 409 })
    console.error('[intern-sessions POST]', e)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}
