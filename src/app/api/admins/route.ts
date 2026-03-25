export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, hashPassword } from '@/lib/auth'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import { z } from 'zod'

const CreateAdminSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(128),
  name:     z.string().min(2).max(100),
  role:     z.enum(['SUPER_ADMIN', 'ADMIN', 'STAFF']).default('STAFF'),
})

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (admin.role === 'STAFF') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const convex  = getConvexClient()
    const admins  = await convex.query(api.admins.getAll, {})
    return NextResponse.json(admins)
  } catch (err) {
    console.error('[admins/GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (admin.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Only Super Admin can create accounts' }, { status: 403 })

    const parsed = CreateAdminSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const convex = getConvexClient()
    const id = await convex.mutation(api.admins.create, {
      username:     parsed.data.username.toLowerCase(),
      passwordHash: await hashPassword(parsed.data.password),
      name:         parsed.data.name,
      role:         parsed.data.role,
    })
    return NextResponse.json({ _id: id, username: parsed.data.username, name: parsed.data.name, role: parsed.data.role }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('already exists')) return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
    console.error('[admins/POST]', msg)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
