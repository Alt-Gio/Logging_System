export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { progressNote, closedBy } = await req.json()
    if (!progressNote?.trim()) {
      return NextResponse.json({ error: 'Progress note is required' }, { status: 400 })
    }

    const convex = getConvexClient()
    const result = await convex.mutation(api.internSessions.timeOut, {
      sessionId:    params.id as Id<'internSessions'>,
      progressNote: progressNote.trim(),
      closedBy:     closedBy ?? 'manual',
    })
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('not found'))    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (msg.includes('already closed')) return NextResponse.json({ error: 'Session already closed' }, { status: 409 })
    console.error('[intern-sessions PATCH]', e)
    return NextResponse.json({ error: 'Failed to close session' }, { status: 500 })
  }
}
