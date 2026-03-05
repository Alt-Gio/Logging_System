import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const CreateLogSchema = z.object({
  fullName: z.string().min(2).max(100),
  agency: z.string().min(2).max(100),
  purpose: z.string().min(3).max(500),
  equipmentUsed: z.array(z.string()).min(1),
  signature: z.string().optional(),
  pcId: z.string().optional().nullable(),
  photoDataUrl: z.string().optional().nullable(),
  plannedDurationHours: z.number().min(0.25).max(8).default(1),
})

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const date = searchParams.get('date')
    const search = searchParams.get('search')
    const showArchived = searchParams.get('archived') === 'true'
    const where: Record<string, unknown> = { archived: showArchived }
    if (date) {
      const start = new Date(date); start.setHours(0,0,0,0)
      const end = new Date(date); end.setHours(23,59,59,999)
      where.timeIn = { gte: start, lte: end }
    }
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { agency: { contains: search, mode: 'insensitive' } },
        { purpose: { contains: search, mode: 'insensitive' } },
      ]
    }
    const [logs, total] = await Promise.all([
      prisma.logEntry.findMany({
        where,
        include: { pc: { select: { name: true, ipAddress: true } } },
        orderBy: { timeIn: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.logEntry.count({ where }),
    ])
    return NextResponse.json({ logs, total, page, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = CreateLogSchema.parse(body)
    const log = await prisma.logEntry.create({
      data: {
        fullName: data.fullName,
        agency: data.agency,
        purpose: data.purpose,
        equipmentUsed: data.equipmentUsed,
        signature: data.signature ?? null,
        pcId: data.pcId || null,
        photoDataUrl: data.photoDataUrl ?? null,
        plannedDurationHours: data.plannedDurationHours,
        timeIn: new Date(),
      },
      include: { pc: { select: { name: true } } },
    })
    if (data.pcId) {
      await prisma.pC.update({ where: { id: data.pcId }, data: { status: 'IN_USE' } }).catch(() => {})
    }
    return NextResponse.json(log, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Validation', details: err.errors }, { status: 400 })
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
