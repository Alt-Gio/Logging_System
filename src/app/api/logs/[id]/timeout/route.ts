// src/app/api/logs/[id]/timeout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { triggerEvent, EVENTS } from '@/lib/pusher'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const log = await prisma.logEntry.findUnique({
    where: { id: params.id },
    include: { pc: { select: { id: true, name: true } } },
  })
  if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (log.timeOut) return NextResponse.json({ error: 'Already checked out' }, { status: 400 })
  if (log.archived) return NextResponse.json({ error: 'Log is archived' }, { status: 400 })

  const now = new Date()
  const updated = await prisma.logEntry.update({
    where: { id: params.id },
    data: { timeOut: now },
    include: { pc: { select: { id: true, name: true } } },
  })

  if (log.pcId) {
    const hasOtherActive = await prisma.logEntry.findFirst({
      where: { pcId: log.pcId, id: { not: params.id }, timeOut: null, archived: false },
    })
    if (!hasOtherActive) {
      await prisma.pC.update({ where: { id: log.pcId }, data: { status: 'ONLINE' } })
    }
  }

  await audit('CHECKOUT', {
    req,
    adminId: admin.id,
    target:  params.id,
    detail:  { fullName: log.fullName, pcName: log.pc?.name },
  })

  await triggerEvent(EVENTS.LOG_UPDATED, {
    id:      updated.id,
    timeOut: now.toISOString(),
    pcName:  updated.pc?.name ?? null,
  })

  return NextResponse.json(updated)
}
