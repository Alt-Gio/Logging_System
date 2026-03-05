import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const pcs = await prisma.pC.findMany({
      where: { isActive: true },
      include: {
        logs: {
          where: { timeOut: null, archived: false },
          orderBy: { timeIn: 'desc' },
          take: 1,
          select: {
            id: true, fullName: true, agency: true,
            timeIn: true, photoDataUrl: true, plannedDurationHours: true,
          },
        },
      },
      orderBy: [{ gridRow: 'asc' }, { gridCol: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json(pcs)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.name || !body.ipAddress) {
      return NextResponse.json({ error: 'Name and IP required' }, { status: 400 })
    }
    // Auto-assign next grid position
    const existing = await prisma.pC.findMany({ select: { gridRow: true, gridCol: true }, orderBy: [{ gridRow: 'asc' }, { gridCol: 'asc' }] })
    let gridCol = 1, gridRow = 1
    if (existing.length > 0) {
      const last = existing[existing.length - 1]
      gridCol = ((last.gridCol ?? 1) % 5) + 1
      gridRow = gridCol === 1 ? (last.gridRow ?? 1) + 1 : (last.gridRow ?? 1)
    }
    const pc = await prisma.pC.create({
      data: {
        name: body.name, ipAddress: body.ipAddress,
        location: body.location || null, icon: body.icon || '🖥️',
        gridCol, gridRow,
      },
    })
    return NextResponse.json(pc, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
