export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

function secret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-fallback-secret-change-me-00000')
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('dict-session')?.value
    if (!token) return NextResponse.json(null)

    const { payload } = await jwtVerify(token, secret())
    const expires = payload.exp
      ? new Date(payload.exp * 1000).toISOString()
      : new Date(Date.now() + 8 * 3_600_000).toISOString()

    return NextResponse.json({
      user: {
        id:    payload.id,
        name:  payload.name,
        email: payload.email,
        role:  payload.role,
      },
      expires,
    })
  } catch {
    return NextResponse.json(null)
  }
}
