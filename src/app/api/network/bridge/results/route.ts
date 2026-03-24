export const dynamic = 'force-dynamic'
// API endpoint for bridge agent to submit scan results
import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

const AGENT_KEY = process.env.NETWORK_BRIDGE_KEY || 'change-this-in-production'

export async function POST(req: NextRequest) {
  // Verify agent key
  const authHeader = req.headers.get('authorization')
  const providedKey = authHeader?.replace('Bearer ', '')
  
  if (providedKey !== AGENT_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { requestId, results } = body

    if (!requestId || !results) {
      return NextResponse.json({ error: 'Missing requestId or results' }, { status: 400 })
    }

    console.log(`[BRIDGE] Received results for request ${requestId}: ${results.length} IPs scanned`)

    const convex = getConvexClient()
    await convex.mutation(api.settings.set, {
      key:   `bridge_results_${requestId}`,
      value: JSON.stringify({ results, timestamp: new Date().toISOString(), completed: true }),
    })
    await convex.mutation(api.settings.deleteByKey, { key: 'bridge_scan_request' }).catch(() => {})

    console.log(`[BRIDGE] Results stored successfully for request ${requestId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[BRIDGE] Results submission error:', error)
    return NextResponse.json({ error: 'Failed to store results' }, { status: 500 })
  }
}
