import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { progressNote, closedBy } = await req.json()
    if (!progressNote?.trim()) {
      return NextResponse.json({ error: 'Progress note is required' }, { status: 400 })
    }

    const session = await (prisma as any).internSession.findUnique({ where: { id: params.id } })
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (session.status === 'CLOSED') return NextResponse.json(session)

    const timeOut = new Date()
    const hours = Math.round(
      ((timeOut.getTime() - new Date(session.timeIn).getTime()) / 3_600_000) * 100
    ) / 100

    const updated = await (prisma as any).internSession.update({
      where: { id: params.id },
      data: {
        timeOut,
        status: 'CLOSED',
        progressNote: progressNote.trim(),
        closedBy: closedBy ?? 'manual',
        hoursLogged: hours,
      },
    })

    await (prisma as any).internAttendance.create({
      data: {
        internId: session.internId,
        date: new Date(session.timeIn),
        timeIn: new Date(session.timeIn),
        timeOut,
        hours,
        status: 'PRESENT',
        notes: progressNote.trim(),
      },
    })

    return NextResponse.json(updated)
  } catch (e) {
    console.error('[intern-sessions PATCH]', e)
    return NextResponse.json({ error: 'Failed to close session' }, { status: 500 })
  }
}
