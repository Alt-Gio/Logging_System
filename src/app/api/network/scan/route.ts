// src/app/api/network/scan/route.ts
import { NextRequest, NextResponse } from 'next/server'
<<<<<<< HEAD
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
=======
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
>>>>>>> 41c2fab67e2056a336b2c8168d30a3e8d0f6ab74
            lastSeen: new Date(),
          },
        })
      }
    }

<<<<<<< HEAD
    const onlineIps = results.map(r => r.ip)
    await prisma.pC.updateMany({
      where: { ipAddress: { notIn: onlineIps }, status: { notIn: ['IN_USE', 'MAINTENANCE'] } },
=======
    // Mark offline PCs that didn't respond
    const onlineIps = results.map(r => r.ip)
    await prisma.pC.updateMany({
      where: {
        ipAddress: { notIn: onlineIps },
        status: { not: 'IN_USE' },
      },
>>>>>>> 41c2fab67e2056a336b2c8168d30a3e8d0f6ab74
      data: { status: 'OFFLINE' },
    })

    return NextResponse.json({
<<<<<<< HEAD
      scanned: `${baseIp}.${startOctet}–${baseIp}.${endOctet}`,
      found:   results.length,
      hosts:   results,
    })
  } catch (err) {
    console.error('[Scan error]', err instanceof Error ? err.message : err)
=======
      scanned: `${baseIp}.${startOctet} - ${baseIp}.${endOctet}`,
      found: results.length,
      hosts: results,
    })
  } catch (err) {
    console.error('Scan error:', err)
>>>>>>> 41c2fab67e2056a336b2c8168d30a3e8d0f6ab74
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
  }
}

<<<<<<< HEAD
export async function GET(req: NextRequest) {
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = new URL(req.url).searchParams.get('ip')
  if (!ip || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return NextResponse.json({ error: 'Valid IP required' }, { status: 400 })
  }
=======
// Quick ping check for a single IP
export async function GET(req: NextRequest) {
  const ip = new URL(req.url).searchParams.get('ip')
  if (!ip) return NextResponse.json({ error: 'IP required' }, { status: 400 })
>>>>>>> 41c2fab67e2056a336b2c8168d30a3e8d0f6ab74

  const { pingHost } = await import('@/lib/network-scanner')
  const result = await pingHost(ip)
  return NextResponse.json(result)
}
