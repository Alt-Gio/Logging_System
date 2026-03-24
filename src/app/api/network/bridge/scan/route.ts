export const dynamic = 'force-dynamic'
// API endpoint for admin panel to request network scan via bridge
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import { z } from 'zod'

const ScanRequestSchema = z.object({
  baseIp: z.string(),
  start: z.number().min(1).max(254),
  end: z.number().min(1).max(254),
})

export async function POST(req: NextRequest) {
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = ScanRequestSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid scan request', details: parsed.error }, { status: 400 })
    }

    const { baseIp, start, end } = parsed.data

    // Generate list of IPs to scan
    const ips: string[] = []
    for (let i = start; i <= end; i++) {
      ips.push(`${baseIp}.${i}`)
    }

    // Create scan request ID
    const requestId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const convex = getConvexClient()
    await convex.mutation(api.settings.set, {
      key:   'bridge_scan_request',
      value: JSON.stringify({
        id: requestId, ips,
        timestamp:   new Date().toISOString(),
        requestedBy: admin.id,
      }),
    })

    console.log(`[BRIDGE] Scan request created: ${requestId} for ${ips.length} IPs`)

    return NextResponse.json({ 
      success: true, 
      requestId,
      message: 'Scan request queued. Bridge agent will process it shortly.',
      ipsToScan: ips.length
    })
  } catch (error) {
    console.error('[BRIDGE] Scan request error:', error)
    return NextResponse.json({ error: 'Failed to create scan request' }, { status: 500 })
  }
}

// Get scan results
export async function GET(req: NextRequest) {
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requestId = new URL(req.url).searchParams.get('requestId')
  if (!requestId) {
    return NextResponse.json({ error: 'requestId required' }, { status: 400 })
  }

  try {
    const convex  = getConvexClient()
    const record   = await convex.query(api.settings.getByKey, { key: `bridge_results_${requestId}` })
    if (!record) {
      return NextResponse.json({ completed: false, message: 'Waiting for bridge agent to process scan...' })
    }
    const data = JSON.parse(record.value)
    return NextResponse.json({ completed: true, results: data.results, timestamp: data.timestamp })
  } catch (error) {
    console.error('[BRIDGE] Get results error:', error)
    return NextResponse.json({ error: 'Failed to retrieve results' }, { status: 500 })
  }
}
