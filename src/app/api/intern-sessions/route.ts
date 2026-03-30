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
        id:            s._id,
        _id:           s._id,
        internId:      s.internId,
        timeIn:        new Date(s.timeIn as number).toISOString(),
        status:        s.status,
        internName:    s.internName ?? null,
        internPhoto:   s.internPhoto ?? null,
        checkInMethod: s.checkInMethod ?? 'direct',
        checkInLat:    s.checkInLat ?? null,
        checkInLng:    s.checkInLng ?? null,
      }))
      return NextResponse.json(sessions)
    }

    const raw = await convex.query(api.internSessions.getActiveSession, {
      internId: internId as Id<'interns'>,
    })
    if (!raw) return NextResponse.json(null)
    const session = {
      id:            raw._id,
      _id:           raw._id,
      internId:      raw.internId,
      timeIn:        new Date(raw.timeIn as number).toISOString(),
      status:        raw.status,
      checkInMethod: (raw.checkInMethod as string) ?? 'direct',
      checkInLat:    (raw.checkInLat as number|null) ?? null,
      checkInLng:    (raw.checkInLng as number|null) ?? null,
    }
    return NextResponse.json(session)
  } catch (e) {
    console.error('[intern-sessions GET]', e)
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { internId, checkInMethod, checkInLat, checkInLng } = body as {
      internId:      string
      checkInMethod?: 'direct' | 'qr' | 'qr_location'
      checkInLat?:    number
      checkInLng?:    number
    }
    if (!internId) return NextResponse.json({ error: 'internId required' }, { status: 400 })

    const convex = getConvexClient()
    const sessionId = await convex.mutation(api.internSessions.timeIn, {
      internId:      internId as Id<'interns'>,
      checkInMethod: checkInMethod ?? 'direct',
      checkInLat:    checkInLat,
      checkInLng:    checkInLng,
    })
    return NextResponse.json({
      id:            sessionId,
      _id:           sessionId,
      internId:      internId,
      timeIn:        new Date().toISOString(),
      status:        'ACTIVE',
      checkInMethod: checkInMethod ?? 'direct',
    }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('already active')) return NextResponse.json({ error: msg }, { status: 409 })
    console.error('[intern-sessions POST]', e)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}
