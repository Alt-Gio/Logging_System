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
  const limit  = Math.min(parseInt(searchParams.get('limit') || '200'), 500)
  const action = searchParams.get('action') || ''
  const where  = action ? { action } : {}

  const logs = await prisma.adminLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { admin: { select: { username: true, name: true } } },
  })
  return NextResponse.json(logs)
  } catch (err) {
    console.error('[API]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }

}
