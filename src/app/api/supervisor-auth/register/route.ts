export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json()
    if (!token || !password) {
      return NextResponse.json({ error: 'token and password required' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    const convex = getConvexClient()
    const supervisor = await convex.query(api.supervisors.getByInviteToken, { token })
    if (!supervisor) return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 400 })
    if (supervisor.inviteExpiry && supervisor.inviteExpiry < Date.now()) {
      return NextResponse.json({ error: 'Invite has expired' }, { status: 400 })
    }
    const passwordHash = await bcrypt.hash(password, 12)
    await convex.mutation(api.supervisors.update, {
      id:            supervisor._id,
      passwordHash,
      emailVerified: true,
      inviteToken:   undefined,
      inviteExpiry:  undefined,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[supervisor-auth/register]', e)
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 })
  }
}
