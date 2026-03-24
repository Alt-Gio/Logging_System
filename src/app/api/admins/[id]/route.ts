export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, hashPassword, verifyPassword } from '@/lib/auth'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
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
    const convex = getConvexClient()

    if (newPassword) {
      if (isSelf) {
        if (!oldPassword) return NextResponse.json({ error: 'Current password required' }, { status: 400 })
        const target = await convex.query(api.admins.getById, { id: params.id as Id<'admins'> })
        if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        const valid = await verifyPassword(oldPassword, target.passwordHash)
        if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      } else if (!isSuperAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      await convex.mutation(api.admins.updatePassword, {
        id:           params.id as Id<'admins'>,
        passwordHash: await hashPassword(newPassword),
      })
    }

    if (name || (role && isSuperAdmin)) {
      await convex.mutation(api.admins.update, {
        id:   params.id as Id<'admins'>,
        ...(name              && { name }),
        ...(role && isSuperAdmin && { role }),
      })
    }

    if (!name && !role && !newPassword) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
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

    const convex = getConvexClient()
    await convex.mutation(api.admins.remove, { id: params.id as Id<'admins'> })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admins/DELETE]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
