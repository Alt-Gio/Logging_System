export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

type HourRow    = { hour: number;  count: bigint }
type AvgDurRow  = { avg_mins: number | null }
type DailyRow   = { day: string;   count: bigint }
type DurBucket  = { bucket: string; count: bigint }
type AgencyRow  = { agency: string; _count: { _all: number } }
type PurposeRow = { purpose: string; _count: { _all: number } }
type ServiceRow = { serviceType: string; _count: { _all: number } }
type RatingRow  = { satisfactionRating: number | null; _count: { _all: number } }
type EquipRow   = { equipmentUsed: string[] }

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const range = searchParams.get('range') || 'week'

    const now = new Date()
    let dateFrom: Date
    let prevFrom: Date
    switch (range) {
      case 'today':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        prevFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
        break
      case 'week':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
        prevFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13)
        break
      case 'month':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
        prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        break
      case 'year':
        dateFrom = new Date(now.getFullYear(), 0, 1)
        prevFrom = new Date(now.getFullYear() - 1, 0, 1)
        break
      case 'all':
        dateFrom = new Date('2020-01-01')
        prevFrom = new Date('2020-01-01')
        break
      default:
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
        prevFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13)
    }

    const where     = { archived: false, timeIn: { gte: dateFrom } }
    const prevWhere = { archived: false, timeIn: { gte: prevFrom, lt: dateFrom } }

    const [
      total, active, checkedOut, prevTotal,
      byPurpose, byAgency, byEquipment, byServiceType,
      byHour, avgDuration, avgRating, ratingDist,
      dailyTrend, durationBuckets,
    ] = await Promise.all([
      prisma.logEntry.count({ where }),
      prisma.logEntry.count({ where: { ...where, timeOut: null } }),
      prisma.logEntry.count({ where: { ...where, timeOut: { not: null } } }),
      prisma.logEntry.count({ where: prevWhere }),

      prisma.logEntry.groupBy({
        by: ['purpose'], where,
        _count: { _all: true },
        orderBy: { _count: { purpose: 'desc' } },
        take: 12,
      }),

      prisma.logEntry.groupBy({
        by: ['agency'], where,
        _count: { _all: true },
        orderBy: { _count: { agency: 'desc' } },
        take: 10,
      }),

      prisma.logEntry.findMany({ where, select: { equipmentUsed: true } }),

      prisma.logEntry.groupBy({ by: ['serviceType'], where, _count: { _all: true } }),

      prisma.$queryRaw<HourRow[]>`
        SELECT EXTRACT(HOUR FROM "timeIn" AT TIME ZONE 'Asia/Manila')::int AS hour,
               COUNT(*) AS count
        FROM log_entries
        WHERE archived = false AND "timeIn" >= ${dateFrom}
        GROUP BY hour ORDER BY hour
      `,

      prisma.$queryRaw<AvgDurRow[]>`
        SELECT AVG(EXTRACT(EPOCH FROM ("timeOut" - "timeIn")) / 60)::float AS avg_mins
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
        SELECT DATE("timeIn" AT TIME ZONE 'Asia/Manila')::text AS day,
               COUNT(*) AS count
        FROM log_entries
        WHERE archived = false AND "timeIn" >= ${dateFrom}
        GROUP BY day ORDER BY day
      `,

      // Session duration histogram (buckets: <30m, 30-60m, 1-2h, 2-3h, 3h+)
      prisma.$queryRaw<DurBucket[]>`
        SELECT
          CASE
            WHEN EXTRACT(EPOCH FROM ("timeOut" - "timeIn"))/60 < 30  THEN '<30 min'
            WHEN EXTRACT(EPOCH FROM ("timeOut" - "timeIn"))/60 < 60  THEN '30–60 min'
            WHEN EXTRACT(EPOCH FROM ("timeOut" - "timeIn"))/60 < 120 THEN '1–2 hrs'
            WHEN EXTRACT(EPOCH FROM ("timeOut" - "timeIn"))/60 < 180 THEN '2–3 hrs'
            ELSE '3+ hrs'
          END AS bucket,
          COUNT(*) AS count
        FROM log_entries
        WHERE archived = false AND "timeIn" >= ${dateFrom} AND "timeOut" IS NOT NULL
        GROUP BY bucket ORDER BY MIN(EXTRACT(EPOCH FROM ("timeOut" - "timeIn")))
      `,
    ])

    const equipmentMap: Record<string, number> = {}
    for (const row of (byEquipment as EquipRow[])) {
      for (const eq of row.equipmentUsed) {
        equipmentMap[eq] = (equipmentMap[eq] ?? 0) + 1
      }
    }

    // Period-over-period change
    const trend = prevTotal > 0
      ? Math.round(((total - prevTotal) / prevTotal) * 100)
      : null

    // Completion rate (checked out vs total with planned duration)
    const completionRate = total > 0 ? Math.round((checkedOut / total) * 100) : 0

    return NextResponse.json({
      range, dateFrom: dateFrom.toISOString(),
      summary: {
        total, active, checkedOut, completionRate,
        trend, // % change vs previous period
        avgDurationMins: (avgDuration as AvgDurRow[])[0]?.avg_mins
          ? Math.round((avgDuration as AvgDurRow[])[0].avg_mins!) : null,
        avgRating: avgRating._avg.satisfactionRating
          ? Math.round(avgRating._avg.satisfactionRating * 10) / 10 : null,
        ratingCount: avgRating._count.satisfactionRating,
      },
      byPurpose:       (byPurpose    as PurposeRow[]).map(p  => ({ purpose: p.purpose,   count: p._count._all })),
      byAgency:        (byAgency     as AgencyRow[]).map(a   => ({ agency:  a.agency,     count: a._count._all })),
      byEquipment:     Object.entries(equipmentMap).map(([equipment, count]) => ({ equipment, count }))
                         .sort((a, b) => b.count - a.count),
      byServiceType:   (byServiceType as ServiceRow[]).map(s => ({ type: s.serviceType, count: s._count._all })),
      byHour:          (byHour as HourRow[]).map(h           => ({ hour: Number(h.hour), count: Number(h.count) })),
      ratingDist:      (ratingDist as RatingRow[]).map(r     => ({ rating: r.satisfactionRating, count: r._count._all })),
      dailyTrend:      (dailyTrend as DailyRow[]).map(d      => ({ day: d.day, count: Number(d.count) })),
      durationBuckets: (durationBuckets as DurBucket[]).map(b => ({ bucket: b.bucket, count: Number(b.count) })),
    })
  } catch (err) {
    console.error('[stats/GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
