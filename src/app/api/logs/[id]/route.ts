export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const raw = await req.json()
    const isRatingOnly = Object.keys(raw).length === 1 && 'satisfactionRating' in raw

    // Satisfaction rating is public (client submits after session)
    // Everything else requires admin auth
    if (!isRatingOnly) {
      const admin = await requireAuth(req)
      if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const convex   = getConvexClient()
    const existing = await convex.query(api.logEntries.getById, { id: params.id as Id<'logEntries'> })
    if (!existing) return NextResponse.json({ error: 'Log entry not found' }, { status: 404 })

    const data = raw
    await convex.mutation(api.logEntries.update, {
      id:                   params.id as Id<'logEntries'>,
      fullName:             data.fullName,
      agency:               data.agency,
      purpose:              data.purpose,
      equipmentUsed:        data.equipmentUsed,
      plannedDurationHours: data.plannedDurationHours,
      archived:             data.archived,
      staffNotes:           data.staffNotes,
      serviceType:          data.serviceType,
      satisfactionRating:   data.satisfactionRating,
      timeIn:               data.timeIn  ? new Date(data.timeIn).getTime()  : undefined,
      timeOut:              data.timeOut ? new Date(data.timeOut).getTime() : undefined,
    })

    if (data.timeOut && existing.pcId) {
      await convex.mutation(api.pcs.updateStatus, {
        id: existing.pcId, status: 'ONLINE', lastSeen: Date.now(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[logs/[id] PATCH]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const convex = getConvexClient()
    await convex.mutation(api.logEntries.archive, { id: params.id as Id<'logEntries'> })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[logs/[id] DELETE]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
