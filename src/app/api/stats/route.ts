import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const today = new Date(); today.setHours(0,0,0,0)
    const todayEnd = new Date(); todayEnd.setHours(23,59,59,999)

    const [total, todayCount, active, pcsAll] = await Promise.all([
      prisma.logEntry.count({ where: { archived: false } }),
      prisma.logEntry.count({ where: { archived: false, timeIn: { gte: today, lte: todayEnd } } }),
      prisma.logEntry.count({ where: { archived: false, timeOut: null } }),
      prisma.pC.groupBy({ by: ['status'], _count: { _all: true } }),
    ])

    const pcs = Object.fromEntries(
      pcsAll.map(g => [g.status.toLowerCase(), g._count._all])
    )
    pcs.online = pcs.online || 0
    pcs.offline = pcs.offline || 0
    pcs.in_use = pcs.in_use || 0

    return NextResponse.json({ total, today: todayCount, active, pcs })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
