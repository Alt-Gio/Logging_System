import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
<<<<<<< HEAD
import { requireAuth } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { PcUpdateSchema } from '@/lib/validation'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const raw = await req.json()
    const parsed = PcUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const pc = await prisma.pC.update({ where: { id: params.id }, data: parsed.data })
    await audit('EDIT_PC', { req, adminId: admin.id, target: params.id, detail: parsed.data })
    return NextResponse.json(pc)
  } catch (err) {
    console.error('[pcs/PATCH]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
=======

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const pc = await prisma.pC.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.ipAddress !== undefined && { ipAddress: body.ipAddress }),
        ...(body.location !== undefined && { location: body.location }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.ssid !== undefined && { ssid: body.ssid || null }),
        ...(body.specs !== undefined && { specs: body.specs || null }),
        ...(body.icon !== undefined && { icon: body.icon || '🖥️' }),
        ...(body.gridCol !== undefined && { gridCol: body.gridCol }),
        ...(body.gridRow !== undefined && { gridRow: body.gridRow }),
      },
    })
    return NextResponse.json(pc)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
>>>>>>> 41c2fab67e2056a336b2c8168d30a3e8d0f6ab74
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
<<<<<<< HEAD
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await prisma.pC.update({ where: { id: params.id }, data: { isActive: false } })
    await audit('DELETE_PC', { req, adminId: admin.id, target: params.id })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[pcs/DELETE]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
=======
    await prisma.pC.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
>>>>>>> 41c2fab67e2056a336b2c8168d30a3e8d0f6ab74
  }
}
