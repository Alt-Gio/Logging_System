// src/app/api/logs/[id]/timeout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const log = await prisma.logEntry.findUnique({ where: { id: params.id } })
  if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (log.timeOut) return NextResponse.json({ error: 'Already checked out' }, { status: 400 })

  const updated = await prisma.logEntry.update({
    where: { id: params.id },
    data: { timeOut: new Date() },
    include: { pc: { select: { name: true } } },
  })

  // Free up the PC
  if (log.pcId) {
    await prisma.pC.update({
      where: { id: log.pcId },
      data: { status: 'ONLINE' },
    })
  }

  return NextResponse.json(updated)
}
