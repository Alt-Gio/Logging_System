export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hashPassword, verifyPassword } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const UpdateAdminSchema = z.object({
  name:        z.string().min(2).max(100).optional(),
  role:        z.enum(['SUPER_ADMIN', 'ADMIN', 'STAFF']).optional(),
  newPassword: z.string().min(8).max(128).optional(),
  oldPassword: z.string().max(128).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isSelf       = admin.id === params.id
    const isSuperAdmin = admin.role === 'SUPER_ADMIN'
    if (!isSelf && !isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const parsed = UpdateAdminSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { name, role, newPassword, oldPassword } = parsed.data
    const updateData: Record<string, unknown> = {}
    if (name) updateData.name = name
    if (role && isSuperAdmin) updateData.role = role

    if (newPassword) {
      if (isSelf) {
        if (!oldPassword) return NextResponse.json({ error: 'Current password required' }, { status: 400 })
        const target = await prisma.admin.findUnique({ where: { id: params.id } })
        if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        const valid = await verifyPassword(oldPassword, target.password)
        if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      } else if (!isSuperAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      updateData.password = await hashPassword(newPassword)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const updated = await prisma.admin.update({
      where: { id: params.id },
      data: updateData,
      select: { id: true, username: true, name: true, role: true },
    })

    await audit('CHANGE_SETTING', {
      req, adminId: admin.id, target: params.id,
      detail: { action: 'UPDATE_ADMIN', changed: Object.keys(updateData).filter(k => k !== 'password') },
    })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[admins/PATCH]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (admin.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (admin.id === params.id) return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })

    await prisma.admin.delete({ where: { id: params.id } })
    await audit('CHANGE_SETTING', { req, adminId: admin.id, target: params.id, detail: { action: 'DELETE_ADMIN' } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admins/DELETE]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
