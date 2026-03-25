export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function GET(_req: NextRequest) {
  try {
    const convex = getConvexClient()
    const [activeLogs, allPcs, todayCount, activeInterns] = await Promise.all([
      convex.query(api.logEntries.getActive, {}),
      convex.query(api.pcs.getActive, {}),
      convex.query(api.logEntries.getTodayCount, {}),
      convex.query(api.interns.getActiveCount, {}),
    ])
    const payload = {
      totalEntries:  activeLogs.length,
      activeNow:     activeLogs.filter(l => !l.timeOut).length,
      pcsOnline:     allPcs.filter(p => p.status === 'ONLINE').length,
      pcsInUse:      allPcs.filter(p => p.status === 'IN_USE').length,
      todayCount,
      activeInterns,
      ts: Date.now(),
    }
    return NextResponse.json(payload)
  } catch (err) {
    console.error('[stats/live]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
