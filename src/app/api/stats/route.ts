export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

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

    const convex      = getConvexClient()
    const dateTo      = now.getTime()
    const [logs, prevLogs] = await Promise.all([
      convex.query(api.logEntries.getByDate, { dateFrom: dateFrom.getTime(), dateTo }),
      convex.query(api.logEntries.getByDate, { dateFrom: prevFrom.getTime(), dateTo: dateFrom.getTime() }),
    ])
    const entries     = logs.filter(l => !l.archived)
    const prevEntries = prevLogs.filter(l => !l.archived)

    const total      = entries.length
    const prevTotal  = prevEntries.length
    const active     = entries.filter(l => !l.timeOut).length
    const checkedOut = entries.filter(l => !!l.timeOut).length

    // ── Aggregations ─────────────────────────────────────────────────────────
    const purposeMap:  Record<string, number> = {}
    const agencyMap:   Record<string, number> = {}
    const serviceMap:  Record<string, number> = {}
    const equipMap:    Record<string, number> = {}
    const hourMap:     Record<number, number> = {}
    const dayMap:      Record<string, number> = {}
    const ratingMap:   Record<number, number> = {}
    const bucketOrder = ['<30 min', '30–60 min', '1–2 hrs', '2–3 hrs', '3+ hrs']
    const bucketMap:   Record<string, number> = Object.fromEntries(bucketOrder.map(b => [b, 0]))
    let durationSum = 0, durationCount = 0, ratingSum = 0, ratingCount = 0

    const TZ_OFFSET = 8 * 3600_000 // Asia/Manila = UTC+8

    for (const l of entries) {
      purposeMap[l.purpose]           = (purposeMap[l.purpose]           ?? 0) + 1
      agencyMap[l.agency]             = (agencyMap[l.agency]             ?? 0) + 1
      serviceMap[l.serviceType ?? ''] = (serviceMap[l.serviceType ?? ''] ?? 0) + 1
      for (const eq of l.equipmentUsed) equipMap[eq] = (equipMap[eq] ?? 0) + 1

      const localMs  = l.timeIn + TZ_OFFSET
      const hour     = Math.floor((localMs % 86_400_000) / 3_600_000)
      hourMap[hour]  = (hourMap[hour] ?? 0) + 1

      const dayStr   = new Date(localMs).toISOString().slice(0, 10)
      dayMap[dayStr] = (dayMap[dayStr] ?? 0) + 1

      if (l.timeOut) {
        const mins = (l.timeOut - l.timeIn) / 60_000
        durationSum += mins; durationCount++
        const bucket = mins < 30 ? '<30 min' : mins < 60 ? '30–60 min' : mins < 120 ? '1–2 hrs' : mins < 180 ? '2–3 hrs' : '3+ hrs'
        bucketMap[bucket]++
      }
      if (l.satisfactionRating != null) {
        ratingSum += l.satisfactionRating; ratingCount++
        ratingMap[l.satisfactionRating] = (ratingMap[l.satisfactionRating] ?? 0) + 1
      }
    }

    const trend        = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null
    const completionRate = total > 0 ? Math.round((checkedOut / total) * 100) : 0

    return NextResponse.json({
      range, dateFrom: dateFrom.toISOString(),
      summary: {
        total, active, checkedOut, completionRate, trend,
        avgDurationMins: durationCount > 0 ? Math.round(durationSum / durationCount) : null,
        avgRating:   ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
        ratingCount,
      },
      byPurpose:  Object.entries(purposeMap).map(([purpose, count]) => ({ purpose, count }))
                    .sort((a, b) => b.count - a.count).slice(0, 12),
      byAgency:   Object.entries(agencyMap).map(([agency, count]) => ({ agency, count }))
                    .sort((a, b) => b.count - a.count).slice(0, 10),
      byEquipment: Object.entries(equipMap).map(([equipment, count]) => ({ equipment, count }))
                    .sort((a, b) => b.count - a.count),
      byServiceType: Object.entries(serviceMap).map(([type, count]) => ({ type, count })),
      byHour:      Object.entries(hourMap).map(([h, count]) => ({ hour: Number(h), count }))
                    .sort((a, b) => a.hour - b.hour),
      ratingDist:  Object.entries(ratingMap).map(([r, count]) => ({ rating: Number(r), count })),
      dailyTrend:  Object.entries(dayMap).map(([day, count]) => ({ day, count }))
                    .sort((a, b) => a.day.localeCompare(b.day)),
      durationBuckets: bucketOrder.map(bucket => ({ bucket, count: bucketMap[bucket] })),
    })
  } catch (err) {
    console.error('[stats/GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
