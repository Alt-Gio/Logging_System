import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const intern = await (prisma as any).intern.findUnique({
      where: { id: params.id },
      include: {
        attendance: { orderBy: { date: 'desc' } },
        tasks: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!intern) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const totalHours = intern.attendance.reduce((s: number, a: any) => s + (a.hours ?? 0), 0)
    return NextResponse.json({ ...intern, totalHours })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch intern' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { startDate, endDate, ...rest } = body
    const intern = await (prisma as any).intern.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
      },
    })
    return NextResponse.json(intern)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to update intern' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await (prisma as any).intern.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to delete intern' }, { status: 500 })
  }
}
