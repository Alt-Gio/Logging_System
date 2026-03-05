// src/app/api/network/ping/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { prisma } from '@/lib/prisma'

const execAsync = promisify(exec)

async function pingHost(ip: string): Promise<{ alive: boolean; responseTime: number | null }> {
  const start = Date.now()
  try {
    const isWindows = process.platform === 'win32'
    const cmd = isWindows ? `ping -n 1 -w 1000 ${ip}` : `ping -c 1 -W 1 ${ip}`
    await execAsync(cmd)
    return { alive: true, responseTime: Date.now() - start }
  } catch {
    return { alive: false, responseTime: null }
  }
}

// POST /api/network/ping — ping one or many IPs, update DB
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // Can be { ip: '192.168.1.101' } or { ips: ['192.168.1.101', ...] } or { pcId: '...' }
    
    let targets: { id?: string; ip: string }[] = []

    if (body.pcId) {
      const pc = await prisma.pC.findUnique({ where: { id: body.pcId } })
      if (!pc) return NextResponse.json({ error: 'PC not found' }, { status: 404 })
      targets = [{ id: pc.id, ip: pc.ipAddress }]
    } else if (body.ip) {
      // Single IP — check if it's in the DB
      const pc = await prisma.pC.findUnique({ where: { ipAddress: body.ip } })
      targets = [{ id: pc?.id, ip: body.ip }]
    } else if (body.ips) {
      targets = body.ips.map((ip: string) => ({ ip }))
    } else if (body.pingAll) {
      // Ping all registered PCs
      const pcs = await prisma.pC.findMany({ select: { id: true, ipAddress: true } })
      targets = pcs.map(p => ({ id: p.id, ip: p.ipAddress }))
    }

    const results = await Promise.all(
      targets.map(async (t) => {
        const result = await pingHost(t.ip)
        // Update DB if we have a known PC id
        if (t.id) {
          const currentPc = await prisma.pC.findUnique({ where: { id: t.id } })
          const newStatus = result.alive
            ? (currentPc?.status === 'IN_USE' ? 'IN_USE' : 'ONLINE')
            : 'OFFLINE'
          await prisma.pC.update({
            where: { id: t.id },
            data: { status: newStatus, lastSeen: result.alive ? new Date() : undefined },
          })
        }
        return { ip: t.ip, pcId: t.id, ...result }
      })
    )

    return NextResponse.json({ results })
  } catch (err) {
    console.error('Ping error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// GET /api/network/ping?ip=192.168.1.x — quick single ping
export async function GET(req: NextRequest) {
  const ip = new URL(req.url).searchParams.get('ip')
  if (!ip) return NextResponse.json({ error: 'ip param required' }, { status: 400 })
  const result = await pingHost(ip)
  // Also update DB if this IP is registered
  try {
    const pc = await prisma.pC.findUnique({ where: { ipAddress: ip } })
    if (pc) {
      const newStatus = result.alive
        ? (pc.status === 'IN_USE' ? 'IN_USE' : 'ONLINE')
        : 'OFFLINE'
      await prisma.pC.update({
        where: { id: pc.id },
        data: { status: newStatus, lastSeen: result.alive ? new Date() : undefined },
      })
    }
    return NextResponse.json({ ip, ...result, pcId: pc?.id ?? null, pcName: pc?.name ?? null })
  } catch {
    return NextResponse.json({ ip, ...result })
  }
}
