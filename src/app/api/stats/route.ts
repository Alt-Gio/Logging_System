<<<<<<< HEAD
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

type EquipmentRow  = { equipmentUsed: string[] }
type HourRow       = { hour: number; count: bigint }
type AvgDurRow     = { avg_mins: number | null }
type DailyRow      = { day: string; count: bigint }
type ServiceRow    = { serviceType: string; _count: { _all: number } }
type PurposeRow    = { purpose: string; _count: { _all: number } }
type RatingRow     = { satisfactionRating: number | null; _count: { _all: number } }

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const range = searchParams.get('range') || 'today'

    const now = new Date()
    let dateFrom: Date
    switch (range) {
      case 'week':  dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6); break
      case 'month': dateFrom = new Date(now.getFullYear(), now.getMonth(), 1); break
      case 'year':  dateFrom = new Date(now.getFullYear(), 0, 1); break
      case 'all':   dateFrom = new Date('2020-01-01'); break
      default:      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    }

    const where = { archived: false, timeIn: { gte: dateFrom } }

    const [
      total, active, checkedOut,
      byPurpose, byEquipment, byServiceType,
      byHour, avgDuration, avgRating, ratingDist, dailyTrend,
    ] = await Promise.all([
      prisma.logEntry.count({ where }),
      prisma.logEntry.count({ where: { ...where, timeOut: null } }),
      prisma.logEntry.count({ where: { ...where, timeOut: { not: null } } }),

      prisma.logEntry.groupBy({
        by: ['purpose'], where,
        _count: { _all: true },
        orderBy: { _count: { purpose: 'desc' } },
        take: 10,
      }),

      prisma.logEntry.findMany({ where, select: { equipmentUsed: true } }),

      prisma.logEntry.groupBy({ by: ['serviceType'], where, _count: { _all: true } }),

      prisma.$queryRaw<HourRow[]>`
        SELECT EXTRACT(HOUR FROM "timeIn" AT TIME ZONE 'Asia/Manila')::int as hour,
               COUNT(*) as count
        FROM log_entries
        WHERE archived = false AND "timeIn" >= ${dateFrom}
        GROUP BY hour ORDER BY hour
      `,

      prisma.$queryRaw<AvgDurRow[]>`
        SELECT AVG(EXTRACT(EPOCH FROM ("timeOut" - "timeIn")) / 60)::float as avg_mins
        FROM log_entries
        WHERE archived = false AND "timeIn" >= ${dateFrom} AND "timeOut" IS NOT NULL
      `,

      prisma.logEntry.aggregate({
        where: { ...where, satisfactionRating: { not: null } },
        _avg:   { satisfactionRating: true },
        _count: { satisfactionRating: true },
      }),

      prisma.logEntry.groupBy({
        by: ['satisfactionRating'],
        where: { ...where, satisfactionRating: { not: null } },
        _count: { _all: true },
      }),

      prisma.$queryRaw<DailyRow[]>`
        SELECT DATE("timeIn" AT TIME ZONE 'Asia/Manila')::text as day,
               COUNT(*) as count
        FROM log_entries
        WHERE archived = false AND "timeIn" >= ${dateFrom}
        GROUP BY day ORDER BY day
      `,
    ])

    const equipmentMap: Record<string, number> = {}
    for (const row of (byEquipment as EquipmentRow[])) {
      for (const eq of row.equipmentUsed) {
        equipmentMap[eq] = (equipmentMap[eq] ?? 0) + 1
      }
    }

    return NextResponse.json({
      range,
      dateFrom: dateFrom.toISOString(),
      summary: {
        total, active, checkedOut,
        avgDurationMins: (avgDuration as AvgDurRow[])[0]?.avg_mins
          ? Math.round((avgDuration as AvgDurRow[])[0].avg_mins!) : null,
        avgRating: avgRating._avg.satisfactionRating
          ? Math.round(avgRating._avg.satisfactionRating * 10) / 10 : null,
        ratingCount: avgRating._count.satisfactionRating,
      },
      byPurpose:     (byPurpose    as PurposeRow[]).map(p  => ({ purpose: p.purpose, count: p._count._all })),
      byEquipment:   Object.entries(equipmentMap).map(([equipment, count]) => ({ equipment, count }))
                       .sort((a, b) => b.count - a.count),
      byServiceType: (byServiceType as ServiceRow[]).map(s  => ({ type: s.serviceType, count: s._count._all })),
      byHour:        (byHour        as HourRow[]).map(h     => ({ hour: Number(h.hour), count: Number(h.count) })),
      ratingDist:    (ratingDist    as RatingRow[]).map(r   => ({ rating: r.satisfactionRating, count: r._count._all })),
      dailyTrend:    (dailyTrend    as DailyRow[]).map(d    => ({ day: d.day, count: Number(d.count) })),
    })
  } catch (err) {
    console.error('[stats/GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
=======
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
>>>>>>> 41c2fab67e2056a336b2c8168d30a3e8d0f6ab74
  }
}
