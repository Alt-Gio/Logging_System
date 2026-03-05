import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const where: Record<string, unknown> = {}
  if (date) {
    const start = new Date(date); start.setHours(0,0,0,0)
    const end = new Date(date); end.setHours(23,59,59,999)
    where.timeIn = { gte: start, lte: end }
  }
  const logs = await prisma.logEntry.findMany({
    where,
    include: { pc: { select: { name: true } } },
    orderBy: { timeIn: 'asc' },
  })

  // Build CSV
  const headers = ['#','Full Name','Agency','Purpose','Equipment Used','Workstation','Date','Time In','Time Out','Duration (hrs)','Signature']
  const rows = logs.map((log, i) => [
    i + 1,
    `"${log.fullName}"`,
    `"${log.agency}"`,
    `"${log.purpose.replace(/"/g, '""')}"`,
    `"${log.equipmentUsed.join(', ')}"`,
    log.pc?.name || '—',
    format(new Date(log.timeIn), 'yyyy-MM-dd'),
    format(new Date(log.timeIn), 'hh:mm:ss a'),
    log.timeOut ? format(new Date(log.timeOut), 'hh:mm:ss a') : '—',
    log.plannedDurationHours,
    `"${log.signature || '—'}"`,
  ])

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const filename = date
    ? `logbook-${date}.csv`
    : `logbook-all-${format(new Date(), 'yyyy-MM-dd')}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
