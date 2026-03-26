export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-fallback-secret-change-me-00000')
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('supervisor-session')?.value
    if (!token) return NextResponse.json(null)
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.role !== 'SUPERVISOR') return NextResponse.json(null)
    return NextResponse.json({
      id:         payload.id,
      email:      payload.email,
      name:       payload.name,
      department: payload.department,
      role:       payload.role,
    })
  } catch {
    return NextResponse.json(null)
  }
}
