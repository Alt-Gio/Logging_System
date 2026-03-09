export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { AnnouncementSchema } from '@/lib/validation'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const raw = await req.json()
    const partial = AnnouncementSchema.partial().safeParse(raw)
    if (!partial.success) {
      return NextResponse.json({ error: 'Validation failed', details: partial.error.flatten() }, { status: 400 })
    }

    const data: Record<string, unknown> = { ...partial.data }
    if (partial.data.expiresAt) data.expiresAt = new Date(partial.data.expiresAt)
    if (partial.data.expiresAt === null) data.expiresAt = null

    const ann = await prisma.announcement.update({ where: { id: params.id }, data })
    return NextResponse.json(ann)
  } catch (err) {
    console.error('[announcements/PATCH]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await prisma.announcement.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[announcements/DELETE]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
