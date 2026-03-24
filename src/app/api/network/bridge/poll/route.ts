export const dynamic = 'force-dynamic'
// API endpoint for bridge agent to poll for pending scan requests
import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

const AGENT_KEY = process.env.NETWORK_BRIDGE_KEY || 'change-this-in-production'

export async function GET(req: NextRequest) {
  // Verify agent key
  const authHeader = req.headers.get('authorization')
  const providedKey = authHeader?.replace('Bearer ', '')
  
  if (providedKey !== AGENT_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const convex      = getConvexClient()
    const scanSetting  = await convex.query(api.settings.getByKey, { key: 'bridge_scan_request' })
    if (!scanSetting?.value) return NextResponse.json({ scanRequest: null })

    const request    = JSON.parse(scanSetting.value)
    const ageMinutes = (Date.now() - new Date(request.timestamp).getTime()) / 60_000
    if (ageMinutes > 2) {
      await convex.mutation(api.settings.deleteByKey, { key: 'bridge_scan_request' })
      return NextResponse.json({ scanRequest: null })
    }
    return NextResponse.json({ scanRequest: request })
  } catch (error) {
    console.error('[BRIDGE] Poll error:', error)
    return NextResponse.json({ scanRequest: null })
  }
}
