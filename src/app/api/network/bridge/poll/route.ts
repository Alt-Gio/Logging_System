export const dynamic = 'force-dynamic'
// API endpoint for bridge agent to poll for pending scan requests
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const AGENT_KEY = process.env.NETWORK_BRIDGE_KEY || 'change-this-in-production'

export async function GET(req: NextRequest) {
  // Verify agent key
  const authHeader = req.headers.get('authorization')
  const providedKey = authHeader?.replace('Bearer ', '')
  
  if (providedKey !== AGENT_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Find oldest pending scan request
    const scanRequest = await prisma.setting.findUnique({
      where: { key: 'bridge_scan_request' }
    })

    if (!scanRequest || !scanRequest.value) {
      return NextResponse.json({ scanRequest: null })
    }

    const request = JSON.parse(scanRequest.value)
    
    // Check if request is still pending (not older than 2 minutes)
    const requestTime = new Date(request.timestamp)
    const now = new Date()
    const ageMinutes = (now.getTime() - requestTime.getTime()) / 1000 / 60
    
    if (ageMinutes > 2) {
      // Request expired, clear it
      await prisma.setting.delete({ where: { key: 'bridge_scan_request' } })
      return NextResponse.json({ scanRequest: null })
    }

    return NextResponse.json({ scanRequest: request })
  } catch (error) {
    console.error('[BRIDGE] Poll error:', error)
    return NextResponse.json({ scanRequest: null })
  }
}
