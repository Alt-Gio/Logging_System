export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { triggerEvent, EVENTS } from '@/lib/pusher'

export async function GET(req: NextRequest) {
  try {
    const [totalEntries, activeNow, pcsOnline, pcsInUse] = await Promise.all([
      prisma.logEntry.count({ where: { archived: false } }),
      prisma.logEntry.count({ where: { archived: false, timeOut: null } }),
      prisma.pC.count({ where: { status: 'ONLINE', isActive: true } }),
      prisma.pC.count({ where: { status: 'IN_USE',  isActive: true } }),
    ])
    const payload = { totalEntries, activeNow, pcsOnline, pcsInUse, ts: Date.now() }
    await triggerEvent(EVENTS.STATS_UPDATE, payload)
    return NextResponse.json(payload)
  } catch (err) {
    console.error('[stats/live]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
