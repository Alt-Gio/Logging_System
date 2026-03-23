import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

// Provides a CSRF token so next-auth/react signOut() can complete its flow.
// Our custom /api/auth/signout does NOT validate this token — it just clears the cookie.
export async function GET() {
  return NextResponse.json({ csrfToken: randomBytes(16).toString('hex') })
}
