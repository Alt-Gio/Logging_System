import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { CameraSchema } from '@/lib/validation'

export async function GET(req: NextRequest) {
  try {
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const cameras = await prisma.camera.findMany({ orderBy: { sortOrder: 'asc' } })
  return NextResponse.json(cameras)
  } catch (err) {
    console.error('[API]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }

}

export async function POST(req: NextRequest) {
  try {
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = CameraSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const count  = await prisma.camera.count()
  const camera = await prisma.camera.create({ data: { ...parsed.data, sortOrder: count } })
  await audit('CREATE_CAMERA', { req, adminId: admin.id, target: camera.id, detail: { name: camera.name } })
  return NextResponse.json(camera, { status: 201 })
  } catch (err) {
    console.error('[API]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }

}
