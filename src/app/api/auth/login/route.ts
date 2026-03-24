import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { checkLoginRateLimit, recordFailedLogin, clearLoginAttempts } from '@/lib/auth'
import { getConvexClient } from '@/lib/convex-client'

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

    const { api } = await import('@/convex/_generated/api')
    const convex   = getConvexClient()
    const admin     = await convex.query(api.admins.getByUsername, {
      username: String(username).trim().toLowerCase(),
    })

    if (!admin || !(await bcrypt.compare(String(password), admin.passwordHash))) {
      recordFailedLogin(ip)
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })
    }

    clearLoginAttempts(ip)
    await convex.mutation(api.admins.updateLastLogin, { id: admin._id })

    const token = await new SignJWT({
      id:    admin._id,
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
