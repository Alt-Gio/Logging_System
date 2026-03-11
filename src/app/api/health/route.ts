export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

// Public health endpoint — used by Railway healthcheck
// Simple check that doesn't require database connection
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'dict-logbook'
  })
}
