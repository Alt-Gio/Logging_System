export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-fallback-secret-change-me-00000')
}

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

    const convex = getConvexClient()
    const supervisor = await convex.query(api.supervisors.getByInviteToken, { token })
    if (!supervisor) return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 400 })
    if (supervisor.inviteExpiry && supervisor.inviteExpiry < Date.now()) {
      return NextResponse.json({ error: 'Invite has expired' }, { status: 400 })
    }

    await convex.mutation(api.supervisors.update, {
      id:            supervisor._id,
      emailVerified: true,
      inviteToken:   undefined,
      inviteExpiry:  undefined,
    })

    const jwt = await new SignJWT({
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
      supervisor: { id: supervisor._id, email: supervisor.email, name: supervisor.name },
    })
    res.cookies.set('supervisor-session', jwt, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 24,
      path:     '/',
    })
    return res
  } catch (e) {
    console.error('[supervisor-auth/register]', e)
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 })
  }
}
