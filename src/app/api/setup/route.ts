import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function POST(req: NextRequest) {
  const setupToken = req.headers.get('x-setup-token')
  const expected   = process.env.SETUP_TOKEN

  if (!expected) {
    return NextResponse.json(
      { error: 'SETUP_TOKEN is not configured on this server.' },
      { status: 503 },
    )
  }
  if (setupToken !== expected) {
    return NextResponse.json({ error: 'Invalid setup token.' }, { status: 403 })
  }

  let body: { username?: string; password?: string; name?: string; role?: string }
  try { body = await req.json() } catch { body = {} }

  const { username, password, name, role } = body
  if (!username || !password || !name) {
    return NextResponse.json(
      { error: 'username, password, and name are required.' },
      { status: 400 },
    )
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 },
    )
  }

  const validRoles = ['SUPER_ADMIN', 'ADMIN', 'STAFF']
  const safeRole = validRoles.includes(role ?? '') ? role! : 'SUPER_ADMIN'

  const passwordHash = await bcrypt.hash(password, 12)
  const convex       = getConvexClient()

  const id = await convex.mutation(api.admins.createOrUpdate, {
    username:     username.trim().toLowerCase(),
    passwordHash,
    name:         name.trim(),
    role:         safeRole as 'SUPER_ADMIN' | 'ADMIN' | 'STAFF',
  })

  return NextResponse.json({ ok: true, id, username: username.trim().toLowerCase(), role: safeRole })
}
