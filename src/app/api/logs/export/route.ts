export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { format } from 'date-fns'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const date  = searchParams.get('date')
    const month = searchParams.get('month')
    const all   = searchParams.get('all') === 'true'

    const convex = getConvexClient()
    let logs: Awaited<ReturnType<typeof convex.query<typeof api.logEntries.getByDate>>>

    if (date) {
      const d    = new Date(date)
      const from = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      const to   = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
      logs = await convex.query(api.logEntries.getByDate, { dateFrom: from, dateTo: to })
    } else if (month) {
      const parts = month.split('-').map(Number)
      const y = parts[0], m = parts[1]
      logs = await convex.query(api.logEntries.getByDate, {
        dateFrom: new Date(y, m - 1, 1).getTime(),
        dateTo:   new Date(y, m, 1).getTime(),
      })
    } else if (all) {
      logs = await convex.query(api.logEntries.getRecent, { limit: 5000, archived: false })
    } else {
      const today = new Date()
      logs = await convex.query(api.logEntries.getByDate, {
        dateFrom: new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime(),
        dateTo:   new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime(),
      })
    }

    logs = logs.filter(l => !l.archived).sort((a, b) => a.timeIn - b.timeIn)

    const headers = [
      '#', 'Full Name', 'Agency / Organization', 'Purpose', 'Equipment / Services Used',
      'Workstation', 'Service Type', 'Date', 'Time In', 'Time Out',
      'Planned Duration (hrs)', 'Actual Duration (mins)', 'Satisfaction Rating', 'Staff Notes',
    ]

    const rows = logs.map((log, i) => {
      const actualMins = log.timeOut
        ? Math.round((log.timeOut - log.timeIn) / 60000)
        : ''
      return [
        i + 1,
        `"${log.fullName}"`,
        `"${log.agency}"`,
        `"${log.purpose.replace(/"/g, '""')}"`,
        `"${log.equipmentUsed.join(', ')}"`,
        `"${log.pcId ?? '—'}"`,
        log.serviceType ?? 'SELF_SERVICE',
        format(new Date(log.timeIn), 'yyyy-MM-dd'),
        format(new Date(log.timeIn), 'hh:mm:ss a'),
        log.timeOut ? format(new Date(log.timeOut), 'hh:mm:ss a') : '—',
        log.plannedDurationHours,
        actualMins,
        log.satisfactionRating ?? '—',
        `"${(log.staffNotes ?? '').replace(/"/g, '""')}"`,
      ]
    })

    const csv = [headers.join(','), ...rows.map((r: (string | number)[]) => r.join(','))].join('\n')
    const label = date ? date : month ? month : all ? 'all' : format(new Date(), 'yyyy-MM-dd')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="dtc-logbook-${label}.csv"`,
      },
    })
  } catch (err) {
    console.error('[export/GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
