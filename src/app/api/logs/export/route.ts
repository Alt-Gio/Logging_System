export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { format } from 'date-fns'

type LogWithPc = {
  id: string; fullName: string; agency: string; purpose: string
  equipmentUsed: string[]; serviceType: string; timeIn: Date; timeOut: Date | null
  plannedDurationHours: number; satisfactionRating: number | null
  staffNotes: string | null; pc: { name: string } | null
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const date  = searchParams.get('date')
    const month = searchParams.get('month')
    const all   = searchParams.get('all') === 'true'

    const where: Record<string, unknown> = { archived: false }
    if (date) {
      const d = new Date(date)
      where.timeIn = {
        gte: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        lt:  new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1),
      }
    } else if (month) {
      const parts = month.split('-').map(Number)
      const y = parts[0], m = parts[1]
      where.timeIn = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) }
    } else if (!all) {
      const today = new Date()
      where.timeIn = {
        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        lt:  new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
      }
    }

    const logs = (await prisma.logEntry.findMany({
      where,
      include: { pc: { select: { name: true } } },
      orderBy: { timeIn: 'asc' },
    })) as LogWithPc[]

    const headers = [
      '#', 'Full Name', 'Agency / Organization', 'Purpose', 'Equipment / Services Used',
      'Workstation', 'Service Type', 'Date', 'Time In', 'Time Out',
      'Planned Duration (hrs)', 'Actual Duration (mins)', 'Satisfaction Rating', 'Staff Notes',
    ]

    const rows = logs.map((log: LogWithPc, i: number) => {
      const actualMins = log.timeOut
        ? Math.round((new Date(log.timeOut).getTime() - new Date(log.timeIn).getTime()) / 60000)
        : ''
      return [
        i + 1,
        `"${log.fullName}"`,
        `"${log.agency}"`,
        `"${log.purpose.replace(/"/g, '""')}"`,
        `"${log.equipmentUsed.join(', ')}"`,
        `"${log.pc?.name ?? '—'}"`,
        log.serviceType ?? 'SELF_SERVICE',
        format(new Date(log.timeIn),  'yyyy-MM-dd'),
        format(new Date(log.timeIn),  'hh:mm:ss a'),
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
