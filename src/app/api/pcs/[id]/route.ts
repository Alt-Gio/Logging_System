export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await prisma.pC.update({ where: { id: params.id }, data: { isActive: false } })
    await audit('DELETE_PC', { req, adminId: admin.id, target: params.id })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[pcs/DELETE]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
