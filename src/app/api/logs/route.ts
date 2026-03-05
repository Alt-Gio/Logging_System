import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
<<<<<<< HEAD
import { triggerEvent, EVENTS } from '@/lib/pusher'
import { uploadPhoto } from '@/lib/cloudinary'
import { audit } from '@/lib/audit'
import { requireAuth, checkApiRateLimit } from '@/lib/auth'
import { LogCreateSchema } from '@/lib/validation'

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAuth(req)
    const { searchParams } = new URL(req.url)
    const search   = searchParams.get('search') || ''
    const date     = searchParams.get('date')   || ''
    const limit    = Math.min(parseInt(searchParams.get('limit') || '200'), 500)
    const archived = searchParams.get('archived') === 'true'

    const where: Record<string, unknown> = { archived }
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { agency:   { contains: search, mode: 'insensitive' } },
        { purpose:  { contains: search, mode: 'insensitive' } },
      ]
    }
    if (date) {
      const d = new Date(date)
      if (!isNaN(d.getTime())) {
        where.timeIn = {
          gte: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
          lt:  new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1),
        }
      }
    }

    if (admin) {
      // Authenticated: full data including PII
      const logs = await prisma.logEntry.findMany({
        where,
        orderBy: { timeIn: 'desc' },
        take: limit,
        include: { pc: { select: { id: true, name: true } } },
      })
      return NextResponse.json(logs)
    } else {
      // Public/unauthenticated: PII-stripped — only what print page summary needs
      const logs = await prisma.logEntry.findMany({
        where,
        orderBy: { timeIn: 'desc' },
        take: limit,
        select: {
          id: true, timeIn: true, timeOut: true,
          purpose: true, equipmentUsed: true, serviceType: true,
          plannedDurationHours: true, archived: true,
          pc: { select: { id: true, name: true } },
        },
      })
      return NextResponse.json(logs)
    }
  } catch (err) {
    console.error('[logs/GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
=======
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
>>>>>>> 41c2fab67e2056a336b2c8168d30a3e8d0f6ab74
  }
}

export async function POST(req: NextRequest) {
  try {
<<<<<<< HEAD
  // Rate limit public submissions: 10 per minute per IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkApiRateLimit(`log_post:${ip}`, 10)) {
    return NextResponse.json({ error: 'Too many submissions. Please wait.' }, { status: 429 })
  }

  const raw = await req.json()
  const parsed = LogCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const { fullName, agency, purpose, equipmentUsed, pcId, photoDataUrl,
          plannedDurationHours, serviceType, staffNotes } = parsed.data

  // Verify PC exists and is selectable
  if (pcId) {
    const pc = await prisma.pC.findUnique({ where: { id: pcId } })
    if (!pc) return NextResponse.json({ error: 'Workstation not found' }, { status: 404 })
    if (pc.status === 'IN_USE') return NextResponse.json({ error: 'Workstation is already in use' }, { status: 409 })
    if (pc.status === 'MAINTENANCE') return NextResponse.json({ error: 'Workstation is under maintenance' }, { status: 409 })
  }

  const log = await prisma.logEntry.create({
    data: {
      fullName, agency, purpose, equipmentUsed,
      plannedDurationHours, pcId: pcId ?? null,
      serviceType, staffNotes: staffNotes ?? null,
      photoDataUrl: null, photoUrl: null,
    },
    include: { pc: { select: { id: true, name: true } } },
  })

  // Upload photo — non-blocking
  let finalPhotoUrl: string | null = null
  if (photoDataUrl) {
    finalPhotoUrl = await uploadPhoto(photoDataUrl, log.id)
    const isUrl = finalPhotoUrl?.startsWith('http')
    await prisma.logEntry.update({
      where: { id: log.id },
      data: { photoUrl: isUrl ? finalPhotoUrl : null, photoDataUrl: isUrl ? null : finalPhotoUrl },
    })
  }

  if (pcId) await prisma.pC.update({ where: { id: pcId }, data: { status: 'IN_USE' } })

  await audit('CREATE_LOG', { req, target: log.id, detail: { fullName, agency, pcId, serviceType } })
  await triggerEvent(EVENTS.LOG_CREATED, {
    id: log.id, fullName, agency, pcName: log.pc?.name ?? null,
    timeIn: log.timeIn.toISOString(), serviceType,
  })

  return NextResponse.json({ ...log, photoUrl: finalPhotoUrl }, { status: 201 })
  } catch (err) {
    console.error('[API]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }

=======
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
>>>>>>> 41c2fab67e2056a336b2c8168d30a3e8d0f6ab74
}
