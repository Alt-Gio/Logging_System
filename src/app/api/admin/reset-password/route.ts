import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// POST /api/admin/reset-password
// Resets an admin account password using ADMIN_RESET_SECRET env var as auth.
// Set ADMIN_RESET_SECRET in Railway env vars before calling this.
// Remove the env var after resetting for security.
export async function POST(req: NextRequest) {
  try {
    const resetSecret = process.env.ADMIN_RESET_SECRET
    if (!resetSecret) {
      return NextResponse.json(
        { error: 'ADMIN_RESET_SECRET env var is not set. Add it in Railway → Variables first.' },
        { status: 503 },
      )
    }

    const { secret, username, newPassword } = await req.json()

    if (!secret || secret !== resetSecret) {
      return NextResponse.json({ error: 'Invalid reset secret.' }, { status: 403 })
    }
    if (!username || !newPassword) {
      return NextResponse.json({ error: 'username and newPassword are required' }, { status: 400 })
    }
    if ((newPassword as string).length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const admin = await prisma.admin.findUnique({ where: { username } })
    if (!admin) {
      return NextResponse.json({ error: `No admin found with username "${username}"` }, { status: 404 })
    }

    const hash = await bcrypt.hash(newPassword as string, 12)
    await prisma.admin.update({
      where: { username },
      data: { password: hash },
    })

    return NextResponse.json({
      message: `Password reset for "${username}". You can now sign in at /sign-in.`,
      reminder: 'Remove ADMIN_RESET_SECRET from Railway env vars now for security.',
    })
  } catch (e) {
    console.error('[admin/reset-password]', e)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}

// GET — list all admin usernames (no passwords)
export async function GET(req: NextRequest) {
  const resetSecret = process.env.ADMIN_RESET_SECRET
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')

  if (!resetSecret || !secret || secret !== resetSecret) {
    return NextResponse.json({ error: 'Provide ?secret=ADMIN_RESET_SECRET' }, { status: 403 })
  }

  const admins = await prisma.admin.findMany({
    select: { id: true, username: true, name: true, role: true, createdAt: true },
  })
  return NextResponse.json({ admins })
}
