export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { audit } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.name    !== undefined) data.name    = String(body.name).slice(0, 100)
    if (body.url     !== undefined) data.url     = body.url
    if (body.type    !== undefined) data.type    = body.type
    if (body.notes   !== undefined) data.notes   = body.notes
    if (body.enabled !== undefined) data.enabled = Boolean(body.enabled)

    const camera = await prisma.camera.update({ where: { id: params.id }, data })
    return NextResponse.json(camera)
  } catch (err) {
    console.error('[cameras/PATCH]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await prisma.camera.delete({ where: { id: params.id } })
    await audit('DELETE_CAMERA', { req, adminId: admin.id, target: params.id })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[cameras/DELETE]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
