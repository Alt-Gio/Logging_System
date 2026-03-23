import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { checkLoginRateLimit, recordFailedLogin, clearLoginAttempts } from '@/lib/auth'

const COOKIE = 'dict-session'
const MAX_AGE = 8 * 60 * 60

function secret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-fallback-secret-change-me-00000')
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const rate = checkLoginRateLimit(ip)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Retry in ${rate.retryAfter}s.` },
        { status: 429 },
      )
    }

    const { username, password } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required.' }, { status: 400 })
    }

    const admin = await prisma.admin.findUnique({
      where: { username: String(username).trim().toLowerCase() },
      select: { id: true, username: true, name: true, role: true, password: true },
    })

    if (!admin || !(await bcrypt.compare(String(password), admin.password))) {
      recordFailedLogin(ip)
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })
    }

    clearLoginAttempts(ip)
    await prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } })

    const token = await new SignJWT({
      id:    admin.id,
      name:  admin.name ?? admin.username,
      email: admin.username,
      role:  admin.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(secret())

    const res = NextResponse.json({ ok: true, role: admin.role })
    res.cookies.set(COOKIE, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   MAX_AGE,
      path:     '/',
    })
    return res
  } catch (e) {
    console.error('[auth/login]', e)
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 })
  }
}
