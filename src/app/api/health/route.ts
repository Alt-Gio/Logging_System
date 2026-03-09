export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Public health endpoint — used by Railway healthcheck
// Does NOT expose any data; just confirms DB connectivity
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', ts: new Date().toISOString() })
  } catch {
    return NextResponse.json({ status: 'error', message: 'DB unavailable' }, { status: 503 })
  }
}
