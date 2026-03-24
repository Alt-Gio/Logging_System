export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (admin.role === 'STAFF') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const limit   = Math.min(parseInt(searchParams.get('limit') || '500'), 2000)
    const action  = searchParams.get('action')  || ''
    const adminId = searchParams.get('adminId') || ''
    const from    = searchParams.get('from')    || ''
    const to      = searchParams.get('to')      || ''
    const search  = searchParams.get('search')  || ''

    const convex = getConvexClient()
    let logs = await convex.query(api.adminLogs.getFiltered, {
      limit,
      action:  action  || undefined,
      adminId: adminId ? adminId as Id<'admins'> : undefined,
      from:    from    ? new Date(from).getTime()            : undefined,
      to:      to      ? new Date(to + 'T23:59:59Z').getTime(): undefined,
    })

    if (search) {
      const q = search.toLowerCase()
      logs = logs.filter(l =>
        l.action?.toLowerCase().includes(q) ||
        l.target?.toLowerCase().includes(q) ||
        l.detail?.toLowerCase().includes(q),
      )
    }

    const todayStart = new Date().setHours(0, 0, 0, 0)
    const todayCount = logs.filter(l => l._creationTime >= todayStart).length

    const actionFreq: Record<string, number> = {}
    for (const l of logs) actionFreq[l.action] = (actionFreq[l.action] ?? 0) + 1

    return NextResponse.json({ logs, totalCount: logs.length, todayCount, actionFreq })
  } catch (err) {
    console.error('[API admin-logs]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
