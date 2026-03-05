// src/app/api/cron/route.ts
// Called by QStash every 5 minutes to auto-checkout overdue sessions
// Also accepts GET with ?secret=CRON_SECRET for manual triggers
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { triggerEvent, EVENTS } from '@/lib/pusher'
import { audit } from '@/lib/audit'

type LogWithPc = {
  id: string; fullName: string; pcId: string | null; timeIn: Date
  plannedDurationHours: number; pc: { name: string } | null
}

function verifyCronSecret(provided: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  return provided === cronSecret
}

export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get('secret')
  if (!verifyCronSecret(secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runExpiry()
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runExpiry()
}

async function runExpiry(): Promise<NextResponse> {
  const now = new Date()

  const activeLogs = (await prisma.logEntry.findMany({
    where:   { timeOut: null, archived: false },
    include: { pc: { select: { name: true } } },
  })) as LogWithPc[]

  const toExpire = activeLogs.filter((log: LogWithPc) => {
    const expectedOut = log.timeIn.getTime() + log.plannedDurationHours * 3_600_000
    // 10-minute grace period
    return expectedOut + 600_000 < now.getTime()
  })

  let checkedOut = 0
  for (const log of toExpire) {
    await prisma.logEntry.update({ where: { id: log.id }, data: { timeOut: now } })

    if (log.pcId) {
      const hasOtherActive = await prisma.logEntry.findFirst({
        where: { pcId: log.pcId, id: { not: log.id }, timeOut: null, archived: false },
      })
      if (!hasOtherActive) {
        await prisma.pC.update({ where: { id: log.pcId }, data: { status: 'ONLINE' } })
      }
    }

    await triggerEvent(EVENTS.SESSION_EXPIRY, {
      logId: log.id, fullName: log.fullName,
      pcName: log.pc?.name ?? null, timeOut: now.toISOString(),
    })
    await audit('AUTO_CHECKOUT', {
      target: log.id,
      detail: { fullName: log.fullName, reason: 'planned duration exceeded' },
    })
    checkedOut++
  }

  return NextResponse.json({
    checked:    toExpire.length,
    checkedOut,
    active:     activeLogs.length - toExpire.length,
    runAt:      now.toISOString(),
  })
}
