// src/app/api/network/scan/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { scanRange, getLocalNetwork, getMacAddress } from '@/lib/network-scanner'
import { prisma } from '@/lib/prisma'

export const maxDuration = 60 // 60 seconds for Railway

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const baseIp = body.baseIp || (await getLocalNetwork())
    const startOctet = body.startOctet || 1
    const endOctet = body.endOctet || 254

    // Scan the network
    const results = await scanRange(baseIp, startOctet, endOctet, 50)

    // Update PC statuses in DB
    for (const result of results) {
      const existingPc = await prisma.pC.findUnique({ where: { ipAddress: result.ip } })

      if (existingPc) {
        await prisma.pC.update({
          where: { ipAddress: result.ip },
          data: {
            status: existingPc.status === 'IN_USE' ? 'IN_USE' : 'ONLINE',
            lastSeen: new Date(),
          },
        })
      }
    }

    // Mark offline PCs that didn't respond
    const onlineIps = results.map(r => r.ip)
    await prisma.pC.updateMany({
      where: {
        ipAddress: { notIn: onlineIps },
        status: { not: 'IN_USE' },
      },
      data: { status: 'OFFLINE' },
    })

    return NextResponse.json({
      scanned: `${baseIp}.${startOctet} - ${baseIp}.${endOctet}`,
      found: results.length,
      hosts: results,
    })
  } catch (err) {
    console.error('Scan error:', err)
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
  }
}

// Quick ping check for a single IP
export async function GET(req: NextRequest) {
  const ip = new URL(req.url).searchParams.get('ip')
  if (!ip) return NextResponse.json({ error: 'IP required' }, { status: 400 })

  const { pingHost } = await import('@/lib/network-scanner')
  const result = await pingHost(ip)
  return NextResponse.json(result)
}
