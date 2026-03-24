export const dynamic = 'force-dynamic'
// src/app/api/cron/route.ts
// Called by QStash every 5 minutes to auto-checkout overdue sessions
// Also accepts GET with ?secret=CRON_SECRET for manual triggers
import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

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
  const now    = Date.now()
  const convex = getConvexClient()

  const activeLogs = await convex.query(api.logEntries.getActive)

  const toExpire = activeLogs.filter(log => {
    const expectedOut = log.timeIn + log.plannedDurationHours * 3_600_000
    return expectedOut + 600_000 < now
  })

  let checkedOut = 0
  for (const log of toExpire) {
    await convex.mutation(api.logEntries.timeOut, {
      id:      log._id as Id<'logEntries'>,
      timeOut: now,
    })

    if (log.pcId) {
      await convex.mutation(api.pcs.updateStatus, {
        id: log.pcId, status: 'ONLINE', lastSeen: now,
      })
    }

    checkedOut++
  }

  return NextResponse.json({
    checked:    toExpire.length,
    checkedOut,
    active:     activeLogs.length - toExpire.length,
    runAt:      new Date(now).toISOString(),
  })
}
