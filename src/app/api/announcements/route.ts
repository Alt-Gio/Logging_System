export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { AnnouncementSchema } from '@/lib/validation'

// Public GET — front page reads active announcements
export async function GET() {
  try {
  const now = new Date()
  const announcements = await prisma.announcement.findMany({
    where: {
      active: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  return NextResponse.json(announcements)
  } catch (err) {
    console.error('[API]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }

}

export async function POST(req: NextRequest) {
  try {
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = AnnouncementSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const ann = await prisma.announcement.create({
    data: {
      ...parsed.data,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      createdBy: admin.name,
    },
  })
  await audit('CHANGE_SETTING', { req, adminId: admin.id, target: ann.id, detail: { action: 'CREATE_ANNOUNCEMENT', title: ann.title } })
  return NextResponse.json(ann, { status: 201 })
  } catch (err) {
    console.error('[API]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }

}
