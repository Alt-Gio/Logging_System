export const dynamic = 'force-dynamic'
// src/app/api/network/scan/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { scanRange, getLocalNetwork } from '@/lib/network-scanner'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

export const maxDuration = 60

const ScanSchema = z.object({
  baseIp:      z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}$/).optional(),
  startOctet:  z.number().int().min(1).max(254).default(1),
  endOctet:    z.number().int().min(1).max(254).default(50), // cap at 50 by default
}).refine(d => !d.startOctet || !d.endOctet || d.startOctet <= d.endOctet, {
  message: 'startOctet must be <= endOctet',
}).refine(d => !d.startOctet || !d.endOctet || (d.endOctet - d.startOctet) <= 100, {
  message: 'Scan range cannot exceed 100 hosts',
})

export async function POST(req: NextRequest) {
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await req.json().catch(() => ({}))
  const parsed = ScanSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid scan parameters', details: parsed.error.flatten() }, { status: 400 })
  }

  const { startOctet, endOctet } = parsed.data
  const baseIp = parsed.data.baseIp ?? (await getLocalNetwork())

  try {
    const results = await scanRange(baseIp, startOctet, endOctet, 50)

    for (const result of results) {
      const pc = await prisma.pC.findUnique({ where: { ipAddress: result.ip } })
      if (pc) {
        await prisma.pC.update({
          where: { ipAddress: result.ip },
          data: {
            status: pc.status === 'IN_USE' ? 'IN_USE' : 'ONLINE',
            lastSeen: new Date(),
          },
        })
      }
    }

    const onlineIps = results.map(r => r.ip)
    await prisma.pC.updateMany({
      where: { ipAddress: { notIn: onlineIps }, status: { notIn: ['IN_USE', 'MAINTENANCE'] } },
      data: { status: 'OFFLINE' },
    })

    return NextResponse.json({
      scanned: `${baseIp}.${startOctet}–${baseIp}.${endOctet}`,
      found:   results.length,
      hosts:   results,
    })
  } catch (err) {
    console.error('[Scan error]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = new URL(req.url).searchParams.get('ip')
  if (!ip || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return NextResponse.json({ error: 'Valid IP required' }, { status: 400 })
  }

  const { pingHost } = await import('@/lib/network-scanner')
  const result = await pingHost(ip)
  return NextResponse.json(result)
}
