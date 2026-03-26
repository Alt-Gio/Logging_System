import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'
import bcrypt from 'bcryptjs'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export const dynamic = 'force-dynamic'

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-fallback-secret-change-me-00000')
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, otpCode } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const convex = getConvexClient()
    const account = await convex.query(api.internAccounts.getByEmail, { email: email.toLowerCase().trim() })
    if (!account) return NextResponse.json({ error: 'No account found with that email' }, { status: 401 })

    if (!account.emailVerified) {
      return NextResponse.json({ error: 'Email not verified. Check your inbox.' }, { status: 403 })
    }

    // OTP login (passwordless)
    if (otpCode) {
      const otps = await convex.query(api.otpVerifications.getRecentByContact, {
        contact: email.toLowerCase().trim(),
        since:   Date.now() - 10 * 60_000,
      })
      const valid = otps.find(o =>
        o.otpCode === otpCode && !o.verified && o.expiresAt > Date.now() && o.purpose === 'intern_login',
      )
      if (!valid) return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 401 })
    } else if (password) {
      const ok = await bcrypt.compare(password, account.passwordHash)
      if (!ok) return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
    } else {
      return NextResponse.json({ error: 'Password or OTP required' }, { status: 400 })
    }

    const intern = await convex.query(api.interns.getById, { id: account.internId })
    if (!intern) return NextResponse.json({ error: 'Intern profile not found' }, { status: 404 })

    // Update last login
    await convex.mutation(api.internAccounts.update, { id: account._id, lastLogin: Date.now() })

    const token = await new SignJWT({
      id:       account._id,
      internId: account.internId,
      email:    account.email,
      name:     intern.fullName,
      role:     'INTERN',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(getSecret())

    const res = NextResponse.json({
      ok:      true,
      account: { id: account._id, internId: account.internId, email: account.email, name: intern.fullName },
    })
    res.cookies.set('intern-session', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 24,
      path:     '/',
    })
    return res
  } catch (e) {
    console.error('[intern-auth/login]', e)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
