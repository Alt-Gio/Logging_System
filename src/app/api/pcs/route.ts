import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
<<<<<<< HEAD
import { requireAuth } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { PcCreateSchema } from '@/lib/validation'

export async function GET(req: NextRequest) {
  try {
  const admin = await requireAuth(req)

  const pcs = await prisma.pC.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, location: true, status: true,
      icon: true, gridCol: true, gridRow: true, specs: true,
      lastSeen: true,
      // Internal fields only for authenticated admins
      ...(admin ? { ipAddress: true, macAddress: true, ssid: true } : {}),
      logs: {
        where: { timeOut: null, archived: false },
        orderBy: { timeIn: 'desc' },
        take: 1,
        select: {
          id: true, timeIn: true, plannedDurationHours: true,
          photoUrl: true, photoDataUrl: true,
          // Full name visible to admin only
          ...(admin ? { fullName: true, agency: true } : {}),
        },
      },
    },
    orderBy: [{ gridRow: 'asc' }, { gridCol: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(pcs)
  } catch (err) {
    console.error('[API]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }

=======

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
>>>>>>> 41c2fab67e2056a336b2c8168d30a3e8d0f6ab74
}

export async function POST(req: NextRequest) {
  try {
<<<<<<< HEAD
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await req.json()
  const parsed = PcCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  // Auto-assign next available grid position
  const existing = await prisma.pC.findMany({
    select: { gridRow: true, gridCol: true },
    orderBy: [{ gridRow: 'asc' }, { gridCol: 'asc' }],
  })
  let gridCol = 1, gridRow = 1
  if (existing.length > 0) {
    const last = existing[existing.length - 1]
    gridCol = ((last.gridCol ?? 1) % 5) + 1
    gridRow = gridCol === 1 ? (last.gridRow ?? 1) + 1 : (last.gridRow ?? 1)
  }

  const pc = await prisma.pC.create({
    data: {
      name: parsed.data.name,
      ipAddress: parsed.data.ipAddress,
      location: parsed.data.location ?? null,
      icon: (raw.icon as string) || '🖥️',
      gridCol, gridRow,
    },
  })

  await audit('CREATE_PC', { req, adminId: admin.id, target: pc.id, detail: { name: pc.name } })
  return NextResponse.json(pc, { status: 201 })
  } catch (err) {
    console.error('[API]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }

=======
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
>>>>>>> 41c2fab67e2056a336b2c8168d30a3e8d0f6ab74
}
