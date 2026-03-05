import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hashPassword } from '@/lib/auth'
import { audit } from '@/lib/audit'
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

  const admins = await prisma.admin.findMany({
    select: { id: true, username: true, name: true, role: true, lastLoginAt: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(admins)
  } catch (err) {
    console.error('[API]', err instanceof Error ? err.message : err)
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

  const exists = await prisma.admin.findUnique({ where: { username: parsed.data.username } })
  if (exists) return NextResponse.json({ error: 'Username already taken' }, { status: 409 })

  const newAdmin = await prisma.admin.create({
    data: {
      username: parsed.data.username,
      password: await hashPassword(parsed.data.password),
      name:     parsed.data.name,
      role:     parsed.data.role,
    },
    select: { id: true, username: true, name: true, role: true, createdAt: true },
  })

  await audit('CHANGE_SETTING', {
    req, adminId: admin.id,
    target: newAdmin.id,
    detail: { action: 'CREATE_ADMIN', username: newAdmin.username, role: newAdmin.role },
  })

  return NextResponse.json(newAdmin, { status: 201 })
  } catch (err) {
    console.error('[API]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }

}
