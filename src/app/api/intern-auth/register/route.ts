export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export async function POST(req: NextRequest) {
  try {
    const { token, password, otpCode } = await req.json()
    if (!token || !password || !otpCode) {
      return NextResponse.json({ error: 'token, password, and otpCode required' }, { status: 400 })
    }

    const convex = getConvexClient()
    const account = await convex.query(api.internAccounts.getByInviteToken, { token })
    if (!account) return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 400 })
    if (account.inviteExpiry && account.inviteExpiry < Date.now()) {
      return NextResponse.json({ error: 'Invite link has expired' }, { status: 400 })
    }

    const otps = await convex.query(api.otpVerifications.getRecentByContact, {
      contact: account.email,
      since:   Date.now() - 10 * 60_000,
    })
    const valid = otps.find(o =>
      o.otpCode === otpCode && !o.verified && o.expiresAt > Date.now() && o.purpose === 'intern_verify',
    )
    if (!valid) return NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 400 })

    const passwordHash = await bcrypt.hash(password, 12)
    await convex.mutation(api.internAccounts.update, {
      id:            account._id,
      passwordHash,
      emailVerified: true,
      inviteToken:   undefined,
      inviteExpiry:  undefined,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[intern-auth/register]', e)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
