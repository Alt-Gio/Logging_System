import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { contact, otpCode } = body

    if (!contact || !otpCode) {
      return NextResponse.json({ error: 'Missing contact or OTP code' }, { status: 400 })
    }

    const convex = getConvexClient()
    const result = await convex.mutation(api.otpVerifications.verify, { contact, otpCode })

    if (!result.success) {
      const msg = result.reason === 'expired'    ? 'OTP has expired'
                : result.reason === 'already_used' ? 'OTP already used'
                : 'Invalid or expired OTP code'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'OTP verified successfully' })
  } catch (error) {
    console.error('OTP verify error:', error)
    return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 })
  }
}
