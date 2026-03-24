export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { uploadPhoto } from '@/lib/cloudinary'
import { requireAuth, checkApiRateLimit } from '@/lib/auth'
import { LogCreateSchema } from '@/lib/validation'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAuth(req)
    const { searchParams } = new URL(req.url)
    const search   = searchParams.get('search') || ''
    const date     = searchParams.get('date')   || ''
    const limit    = Math.min(parseInt(searchParams.get('limit') || '200'), 500)
    const archived = searchParams.get('archived') === 'true'

    const convex = getConvexClient()
    let logs: Awaited<ReturnType<typeof convex.query<typeof api.logEntries.getRecent>>>

    if (date) {
      const d = new Date(date)
      if (!isNaN(d.getTime())) {
        const from = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
        const to   = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
        logs = await convex.query(api.logEntries.getByDate, { dateFrom: from, dateTo: to })
      } else {
        logs = await convex.query(api.logEntries.getRecent, { limit, archived })
      }
    } else if (search) {
      logs = await convex.query(api.logEntries.search, { searchTerm: search })
    } else {
      logs = await convex.query(api.logEntries.getRecent, { limit, archived })
    }

    if (!admin) {
      logs = logs.map(({ fullName, agency, contactEmail, contactPhone, ...rest }: typeof logs[number]) =>
        rest as typeof logs[number]
      ) as typeof logs
    }

    return NextResponse.json(logs)
  } catch (err) {
    console.error('[logs/GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
  // Rate limit public submissions: 30 per minute per IP (shared NAT offices can have many concurrent users)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkApiRateLimit(`log_post:${ip}`, 30)) {
    return NextResponse.json({ error: 'Too many submissions. Please wait.' }, { status: 429 })
  }

  const raw = await req.json()
  const parsed = LogCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const { fullName, agency, purpose, equipmentUsed, pcId, photoDataUrl,
          plannedDurationHours, serviceType, staffNotes,
          contactEmail, contactPhone } = parsed.data

  const convex = getConvexClient()

  if (pcId) {
    const pc = await convex.query(api.pcs.getById, { id: pcId as Id<'pcs'> })
    if (!pc) return NextResponse.json({ error: 'Workstation not found' }, { status: 404 })
    if (pc.status === 'IN_USE')    return NextResponse.json({ error: 'Workstation is already in use' }, { status: 409 })
    if (pc.status === 'MAINTENANCE') return NextResponse.json({ error: 'Workstation is under maintenance' }, { status: 409 })
  }

  const now = Date.now()
  const id  = await convex.mutation(api.logEntries.create, {
    fullName, agency, purpose, equipmentUsed,
    plannedDurationHours, serviceType,
    date:         now,
    timeIn:       now,
    pcId:         pcId ? pcId as Id<'pcs'> : undefined,
    staffNotes:   staffNotes   ?? undefined,
    contactEmail: contactEmail ?? undefined,
    contactPhone: contactPhone ?? undefined,
  })

  if (photoDataUrl) {
    uploadPhoto(photoDataUrl, id).then(async url => {
      const isUrl = url?.startsWith('http')
      await convex.mutation(api.logEntries.update, {
        id: id as Id<'logEntries'>,
        photoUrl:    isUrl ? url  : undefined,
        photoDataUrl: isUrl ? undefined : (url ?? undefined),
      })
    }).catch(console.error)
  }

  if (pcId) {
    await convex.mutation(api.pcs.updateStatus, {
      id: pcId as Id<'pcs'>, status: 'IN_USE', lastSeen: now,
    })
  }

  return NextResponse.json({ _id: id }, { status: 201 })
  } catch (err) {
    console.error('[API]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }

}
