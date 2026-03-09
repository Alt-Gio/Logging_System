export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {}
    if (action)  where.action  = action
    if (adminId) where.adminId = adminId

    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to)   where.createdAt.lte = new Date(to + 'T23:59:59Z')
    }

    // Text search across detail + target
    if (search) {
      where.OR = [
        { detail: { contains: search, mode: 'insensitive' } },
        { target: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
      ]
    }

    const logs = await prisma.adminLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { admin: { select: { username: true, name: true } } },
    })

    // Summary counts for the current filter
    const [totalCount, todayCount] = await Promise.all([
      prisma.adminLog.count({ where }),
      prisma.adminLog.count({
        where: {
          ...where,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ])

    // Action frequency map for sparkline
    const actionFreq: Record<string, number> = {}
    for (const l of logs) actionFreq[l.action] = (actionFreq[l.action] ?? 0) + 1

    return NextResponse.json({ logs, totalCount, todayCount, actionFreq })
  } catch (err) {
    console.error('[API admin-logs]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
