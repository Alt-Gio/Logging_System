import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export const dynamic = 'force-dynamic'

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-fallback-secret-change-me-00000')
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const convex = getConvexClient()
    const supervisor = await convex.query(api.supervisors.getByEmail, {
      email: email.toLowerCase().trim(),
    })
    if (!supervisor) {
      return NextResponse.json({ error: 'No supervisor account found' }, { status: 401 })
    }
    if (!supervisor.emailVerified) {
      return NextResponse.json({ error: 'Account not verified. Check your invite email.' }, { status: 403 })
    }

    const ok = await bcrypt.compare(password, supervisor.passwordHash)
    if (!ok) return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })

    await convex.mutation(api.supervisors.update, { id: supervisor._id, lastLogin: Date.now() })

    const token = await new SignJWT({
      id:         supervisor._id,
      email:      supervisor.email,
      name:       supervisor.name,
      department: supervisor.department,
      role:       'SUPERVISOR',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(getSecret())

    const res = NextResponse.json({
      ok: true,
      supervisor: { id: supervisor._id, email: supervisor.email, name: supervisor.name, department: supervisor.department },
    })
    res.cookies.set('supervisor-session', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 24,
      path:     '/',
    })
    return res
  } catch (e) {
    console.error('[supervisor-auth/login]', e)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
