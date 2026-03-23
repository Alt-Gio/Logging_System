import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// POST /api/admin/setup
// Creates the first SUPER_ADMIN account.
// This endpoint is ONLY active when zero admin accounts exist in the database.
export async function POST(req: NextRequest) {
  try {
    const count = await prisma.admin.count()
    if (count > 0) {
      return NextResponse.json(
        { error: 'Setup already completed. An admin account already exists.' },
        { status: 403 },
      )
    }

    const { username, password, name } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'username and password are required' }, { status: 400 })
    }
    if ((password as string).length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const hash = await bcrypt.hash(password as string, 12)
    const admin = await prisma.admin.create({
      data: {
        username: (username as string).trim().toLowerCase(),
        password: hash,
        name: ((name as string | undefined) || username as string).trim(),
        role: 'SUPER_ADMIN',
      },
      select: { id: true, username: true, name: true, role: true, createdAt: true },
    })

    return NextResponse.json(
      { message: 'Admin account created. You can now sign in at /sign-in.', admin },
      { status: 201 },
    )
  } catch (e) {
    console.error('[admin/setup]', e)
    return NextResponse.json({ error: 'Failed to create admin' }, { status: 500 })
  }
}

// GET — health check to see if setup is needed
export async function GET() {
  const count = await prisma.admin.count()
  return NextResponse.json({ setupRequired: count === 0 })
}
