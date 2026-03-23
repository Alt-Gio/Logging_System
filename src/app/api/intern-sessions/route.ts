import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const internId = searchParams.get('internId')

    if (!internId) {
      const all = await (prisma as any).internSession.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { timeIn: 'asc' },
      })
      return NextResponse.json(all)
    }

    const session = await (prisma as any).internSession.findFirst({
      where: { internId, status: 'ACTIVE' },
      orderBy: { timeIn: 'desc' },
    })
    return NextResponse.json(session ?? null)
  } catch (e) {
    console.error('[intern-sessions GET]', e)
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { internId } = await req.json()
    if (!internId) return NextResponse.json({ error: 'internId required' }, { status: 400 })

    const existing = await (prisma as any).internSession.findFirst({
      where: { internId, status: 'ACTIVE' },
    })
    if (existing) return NextResponse.json(existing, { status: 200 })

    const session = await (prisma as any).internSession.create({
      data: { internId, timeIn: new Date(), status: 'ACTIVE' },
    })
    return NextResponse.json(session, { status: 201 })
  } catch (e) {
    console.error('[intern-sessions POST]', e)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}
