export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-fallback-secret-change-me-00000')
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('intern-session')?.value
    if (!token) return NextResponse.json(null)
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.role !== 'INTERN') return NextResponse.json(null)
    return NextResponse.json({
      id:       payload.id,
      internId: payload.internId,
      email:    payload.email,
      name:     payload.name,
      role:     payload.role,
    })
  } catch {
    return NextResponse.json(null)
  }
}
