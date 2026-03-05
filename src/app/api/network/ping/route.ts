// src/app/api/network/ping/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { prisma } from '@/lib/prisma'
<<<<<<< HEAD
import { requireAuth } from '@/lib/auth'
import { validateIpAddress } from '@/lib/errors'
import { z } from 'zod'

const execAsync = promisify(exec)

// Strict IP-only regex — NO shell metacharacters possible
const SAFE_IP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/

async function pingHost(ip: string): Promise<{ alive: boolean; responseTime: number | null }> {
  // Validate BEFORE passing to shell — belt + suspenders with allowlist regex
  if (!SAFE_IP.test(ip)) return { alive: false, responseTime: null }
  const parts = ip.split('.').map(Number)
  if (parts.some(p => p < 0 || p > 255)) return { alive: false, responseTime: null }

  const start = Date.now()
  try {
    const isWindows = process.platform === 'win32'
    // Use array form to prevent shell interpretation; execAsync still needs string
    // but IP is validated to contain ONLY digits and dots above
    const cmd = isWindows
      ? `ping -n 1 -w 1000 ${ip}`
      : `ping -c 1 -W 1 ${ip}`
    await execAsync(cmd, { timeout: 3000 })
=======

const execAsync = promisify(exec)

async function pingHost(ip: string): Promise<{ alive: boolean; responseTime: number | null }> {
  const start = Date.now()
  try {
    const isWindows = process.platform === 'win32'
    const cmd = isWindows ? `ping -n 1 -w 1000 ${ip}` : `ping -c 1 -W 1 ${ip}`
    await execAsync(cmd)
>>>>>>> 41c2fab67e2056a336b2c8168d30a3e8d0f6ab74
    return { alive: true, responseTime: Date.now() - start }
  } catch {
    return { alive: false, responseTime: null }
  }
}

<<<<<<< HEAD
async function smartUpdatePcStatus(pcId: string, alive: boolean) {
  const pc = await prisma.pC.findUnique({ where: { id: pcId } })
  if (!pc) return
  const activeLog = await prisma.logEntry.findFirst({
    where: { pcId, timeOut: null, archived: false },
  })
  let newStatus: 'ONLINE' | 'OFFLINE' | 'IN_USE' | 'MAINTENANCE'
  if (activeLog)             newStatus = 'IN_USE'
  else if (pc.status === 'MAINTENANCE') newStatus = 'MAINTENANCE'
  else if (alive)            newStatus = 'ONLINE'
  else                       newStatus = 'OFFLINE'

  await prisma.pC.update({
    where: { id: pcId },
    data: { status: newStatus, ...(alive ? { lastSeen: new Date() } : {}) },
  })
}

const PingBodySchema = z.union([
  z.object({ pcId: z.string().cuid() }),
  z.object({ ip: z.string().regex(SAFE_IP) }),
  z.object({ ips: z.array(z.string().regex(SAFE_IP)).max(30) }),
  z.object({ pingAll: z.literal(true) }),
])

export async function POST(req: NextRequest) {
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const parsed = PingBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid ping target' }, { status: 400 })
  }

  let targets: { id?: string; ip: string }[] = []

  if ('pcId' in parsed.data) {
    const pc = await prisma.pC.findUnique({ where: { id: parsed.data.pcId } })
    if (!pc) return NextResponse.json({ error: 'PC not found' }, { status: 404 })
    targets = [{ id: pc.id, ip: pc.ipAddress }]
  } else if ('ip' in parsed.data) {
    try { validateIpAddress(parsed.data.ip) } catch { return NextResponse.json({ error: 'Invalid IP' }, { status: 400 }) }
    const pc = await prisma.pC.findUnique({ where: { ipAddress: parsed.data.ip } })
    targets = [{ id: pc?.id, ip: parsed.data.ip }]
  } else if ('ips' in parsed.data) {
    targets = parsed.data.ips.map(ip => ({ ip }))
  } else if ('pingAll' in parsed.data) {
    const pcs = await prisma.pC.findMany({ where: { isActive: true }, select: { id: true, ipAddress: true } })
    targets = pcs.map((p: { id: string; ipAddress: string }) => ({ id: p.id, ip: p.ipAddress }))
  }

  const results = await Promise.all(
    targets.map(async t => {
      const result = await pingHost(t.ip)
      if (t.id) await smartUpdatePcStatus(t.id, result.alive)
      return { ip: t.ip, pcId: t.id, ...result }
    })
  )

  return NextResponse.json({ results })
}

export async function GET(req: NextRequest) {
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = new URL(req.url).searchParams.get('ip')
  if (!ip || !SAFE_IP.test(ip)) return NextResponse.json({ error: 'Valid ip param required' }, { status: 400 })
  try { validateIpAddress(ip) } catch { return NextResponse.json({ error: 'Invalid IP' }, { status: 400 }) }

  const result = await pingHost(ip)
  const pc = await prisma.pC.findUnique({ where: { ipAddress: ip } }).catch(() => null)
  if (pc) await smartUpdatePcStatus(pc.id, result.alive)
  return NextResponse.json({ ip, ...result, pcId: pc?.id ?? null, pcName: pc?.name ?? null })
=======
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
>>>>>>> 41c2fab67e2056a336b2c8168d30a3e8d0f6ab74
}
