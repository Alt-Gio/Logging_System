export const dynamic = 'force-dynamic'
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
      const raw = await convex.query(api.internSessions.getAllActiveSessions, {})
      const sessions = raw.map((s: Record<string,unknown>) => ({
        id:         s._id,
        _id:        s._id,
        internId:   s.internId,
        timeIn:     new Date(s.timeIn as number).toISOString(),
        status:     s.status,
        internName: s.internName ?? null,
        internPhoto:s.internPhoto ?? null,
      }))
      return NextResponse.json(sessions)
    }

    const raw = await convex.query(api.internSessions.getActiveSession, {
      internId: internId as Id<'interns'>,
    })
    if (!raw) return NextResponse.json(null)
    const session = {
      id:       raw._id,
      _id:      raw._id,
      internId: raw.internId,
      timeIn:   new Date(raw.timeIn as number).toISOString(),
      status:   raw.status,
    }
    return NextResponse.json(session)
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
    return NextResponse.json({
      id:       sessionId,
      _id:      sessionId,
      internId: internId,
      timeIn:   new Date().toISOString(),
      status:   'ACTIVE',
    }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('already active')) return NextResponse.json({ error: msg }, { status: 409 })
    console.error('[intern-sessions POST]', e)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}
