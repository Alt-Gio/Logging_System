// src/app/api/auth/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  hashPassword, verifyPassword, generateToken, verifyToken,
  checkLoginRateLimit, recordFailedLogin, clearLoginAttempts
} from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const LoginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
})


// GET /api/auth — verify current session is still valid
export async function GET(req: NextRequest) {
  const cookieToken = req.cookies.get('auth_token')?.value
  const bearerToken = req.headers.get('authorization')?.replace('Bearer ', '')
  const token = cookieToken || bearerToken
  if (!token) return NextResponse.json({ authenticated: false }, { status: 401 })

  const decoded = await verifyToken(token)
  if (!decoded) return NextResponse.json({ authenticated: false }, { status: 401 })

  const admin = await prisma.admin.findUnique({
    where: { id: decoded.adminId },
    select: { id: true, username: true, name: true, role: true },
  })
  if (!admin) return NextResponse.json({ authenticated: false }, { status: 401 })

  // Update lastLoginAt on verify (lazy update)
  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  }).catch(() => {})

  return NextResponse.json({ authenticated: true, admin })
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  // Rate limiting
  const rl = checkLoginRateLimit(ip)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many login attempts. Try again in ${Math.ceil((rl.retryAfter ?? 900) / 60)} minutes.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 900) } }
    )
  }

  // Validate input
  const body = LoginSchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 })
  }

  const { username, password } = body.data

  // Generic timing-safe: always look up even if not found
  const admin = await prisma.admin.findUnique({ where: { username } })

  // Use a dummy hash if admin not found (prevents timing attacks)
  const dummyHash = '$2a$12$invalidhashfortimingreasonsdontuse'
  const passwordValid = admin
    ? await verifyPassword(password, admin.password)
    : await verifyPassword(password, dummyHash).catch(() => false)

  if (!admin || !passwordValid) {
    recordFailedLogin(ip)
    await audit('LOGIN', { req, detail: { username, success: false, reason: 'bad credentials' } })
    // Same error message regardless — don't reveal whether username exists
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  clearLoginAttempts(ip)
  const token = await generateToken(admin.id, admin.role)

  await audit('LOGIN', { req, adminId: admin.id, detail: { username, success: true } })

  const response = NextResponse.json({
    success: true,
    admin: { id: admin.id, name: admin.name, role: admin.role },
  })

  response.cookies.set('auth_token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   8 * 60 * 60,
    path:     '/',
  })

  return response
}

export async function DELETE(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const adminId = req.headers.get('x-admin-id')
  await audit('LOGOUT', { req, adminId: adminId ?? undefined })
  const response = NextResponse.json({ success: true })
  response.cookies.delete('auth_token')
  return response
}

// Seed first admin if none exist — only callable in dev or with SETUP_TOKEN
export async function PUT(req: NextRequest) {
  const setupToken = req.headers.get('x-setup-token')
  if (setupToken !== process.env.SETUP_TOKEN && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const count = await prisma.admin.count()
  if (count > 0) {
    return NextResponse.json({ error: 'Admin already exists' }, { status: 409 })
  }

  const body = await req.json()
  const admin = await prisma.admin.create({
    data: {
      username: body.username || 'admin',
      password: await hashPassword(body.password || 'dict2026!'),
      name:     body.name    || 'DTC Administrator',
      role:     'SUPER_ADMIN',
    },
  })

  return NextResponse.json({ success: true, id: admin.id }, { status: 201 })
}
