// Supervisor login is now OTP-only. This legacy password endpoint is deprecated.
// All login requests are handled by POST /api/supervisor-auth/otp { action:'request'|'verify' }
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json(
    { error: 'Password login is no longer supported. Please use the OTP login at /supervisor/login.' },
    { status: 410 },
  )
}
