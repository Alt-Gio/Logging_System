import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { triggerEvent, EVENTS } from '@/lib/pusher'
import { audit } from '@/lib/audit'
import { requireAuth } from '@/lib/auth'
import { LogUpdateSchema } from '@/lib/validation'

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

    const parsed = LogUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    // Verify log exists and is not archived before editing
    const existing = await prisma.logEntry.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Log entry not found' }, { status: 404 })

    const data = parsed.data
    const updateData: Record<string, unknown> = {}
    if (data.fullName             !== undefined) updateData.fullName             = data.fullName
    if (data.agency               !== undefined) updateData.agency               = data.agency
    if (data.purpose              !== undefined) updateData.purpose              = data.purpose
    if (data.equipmentUsed        !== undefined) updateData.equipmentUsed        = data.equipmentUsed
    if (data.plannedDurationHours !== undefined) updateData.plannedDurationHours = data.plannedDurationHours
    if (data.archived             !== undefined) updateData.archived             = data.archived
    if (data.staffNotes           !== undefined) updateData.staffNotes           = data.staffNotes
    if (data.serviceType          !== undefined) updateData.serviceType          = data.serviceType
    if (data.satisfactionRating   !== undefined) updateData.satisfactionRating   = data.satisfactionRating
    if (data.timeIn  != null) updateData.timeIn  = new Date(data.timeIn)
    if (data.timeOut != null) updateData.timeOut = new Date(data.timeOut)
    // Allow clearing timeOut (null = still active)
    if ('timeOut' in data && data.timeOut === null) updateData.timeOut = null

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const updated = await prisma.logEntry.update({
      where: { id: params.id },
      data: updateData,
      include: { pc: { select: { id: true, name: true } } },
    })

    // If checking out, free the PC
    if (data.timeOut && existing.pcId) {
      const hasOtherActive = await prisma.logEntry.findFirst({
        where: { pcId: existing.pcId, id: { not: params.id }, timeOut: null, archived: false },
      })
      if (!hasOtherActive) {
        await prisma.pC.update({ where: { id: existing.pcId }, data: { status: 'ONLINE' } })
      }
    }

    const adminId = req.headers.get('x-admin-id') ?? undefined
    if (!isRatingOnly) {
      await audit('EDIT_LOG', {
        req, adminId, target: params.id,
        detail: { changes: Object.keys(updateData) },
      })
    }

    await triggerEvent(EVENTS.LOG_UPDATED, {
      id:                 updated.id,
      timeOut:            updated.timeOut?.toISOString() ?? null,
      archived:           updated.archived,
      satisfactionRating: updated.satisfactionRating,
    })

    return NextResponse.json(updated)
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

    const existing = await prisma.logEntry.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.logEntry.update({
      where: { id: params.id },
      data: { archived: true },
    })

    await audit('ARCHIVE_LOG', { req, adminId: admin.id, target: params.id })
    await triggerEvent(EVENTS.LOG_ARCHIVED, { id: params.id })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[logs/[id] DELETE]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
