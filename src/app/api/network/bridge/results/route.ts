export const dynamic = 'force-dynamic'
// API endpoint for bridge agent to submit scan results
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    // Store results in database
    await prisma.setting.upsert({
      where: { key: `bridge_results_${requestId}` },
      update: { 
        value: JSON.stringify({ 
          results, 
          timestamp: new Date().toISOString(),
          completed: true
        }) 
      },
      create: { 
        key: `bridge_results_${requestId}`,
        value: JSON.stringify({ 
          results, 
          timestamp: new Date().toISOString(),
          completed: true
        })
      }
    })

    // Clear the scan request
    await prisma.setting.delete({ 
      where: { key: 'bridge_scan_request' } 
    }).catch(() => {}) // Ignore if already deleted

    console.log(`[BRIDGE] Results stored successfully for request ${requestId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[BRIDGE] Results submission error:', error)
    return NextResponse.json({ error: 'Failed to store results' }, { status: 500 })
  }
}
