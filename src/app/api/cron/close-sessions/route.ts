import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-cron-secret')
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const activeSessions = await (prisma as any).internSession.findMany({
      where: { status: 'ACTIVE' },
    })

    if (activeSessions.length === 0) {
      return NextResponse.json({ closed: 0, message: 'No active sessions' })
    }

    const now = new Date()
    const results = await Promise.allSettled(
      activeSessions.map(async (session: { id: string; internId: string; timeIn: Date }) => {
        const hours = Math.round(
          ((now.getTime() - new Date(session.timeIn).getTime()) / 3_600_000) * 100
        ) / 100

        await (prisma as any).internSession.update({
          where: { id: session.id },
          data: {
            timeOut: now,
            status: 'CLOSED',
            progressNote: 'Auto-closed at 5:00 PM by system.',
            closedBy: 'cron',
            hoursLogged: hours,
          },
        })

        await (prisma as any).internAttendance.create({
          data: {
            internId: session.internId,
            date: new Date(session.timeIn),
            timeIn: new Date(session.timeIn),
            timeOut: now,
            hours,
            status: 'PRESENT',
            notes: 'Auto-closed at 5:00 PM by system.',
          },
        })
      })
    )

    const closed = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return NextResponse.json({ closed, failed, total: activeSessions.length })
  } catch (e) {
    console.error('[cron/close-sessions]', e)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
