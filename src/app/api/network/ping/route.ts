export const dynamic = 'force-dynamic'
// src/app/api/network/ping/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { validateIpAddress } from '@/lib/errors'
import { z } from 'zod'

const execAsync = promisify(exec)

// Strict IP-only regex — NO shell metacharacters possible
const SAFE_IP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/

async function pingHost(ip: string): Promise<{ alive: boolean; responseTime: number | null; error?: string }> {
  // Validate BEFORE passing to shell — belt + suspenders with allowlist regex
  if (!SAFE_IP.test(ip)) return { alive: false, responseTime: null, error: 'Invalid IP format' }
  const parts = ip.split('.').map(Number)
  if (parts.some(p => p < 0 || p > 255)) return { alive: false, responseTime: null, error: 'IP out of range' }

  const start = Date.now()
  try {
    const isWindows = process.platform === 'win32'
    // Use array form to prevent shell interpretation; execAsync still needs string
    // but IP is validated to contain ONLY digits and dots above
    const cmd = isWindows
      ? `ping -n 1 -w 1000 ${ip}`
      : `ping -c 1 -W 1 ${ip}`
    
    console.log(`[PING] Attempting to ping ${ip} with command: ${cmd}`)
    const { stdout, stderr } = await execAsync(cmd, { timeout: 3000 })
    console.log(`[PING] Success for ${ip} - Response time: ${Date.now() - start}ms`)
    if (stderr) console.log(`[PING] stderr: ${stderr}`)
    
    return { alive: true, responseTime: Date.now() - start }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error(`[PING] Failed for ${ip}: ${error}`)
    
    // Fallback: Try HTTP check on common ports
    try {
      const httpStart = Date.now()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2000)
      
      await fetch(`http://${ip}`, { 
        signal: controller.signal,
        method: 'HEAD'
      }).catch(() => {
        // Try HTTPS
        return fetch(`https://${ip}`, { 
          signal: controller.signal,
          method: 'HEAD'
        })
      })
      
      clearTimeout(timeout)
      const httpTime = Date.now() - httpStart
      console.log(`[PING] HTTP fallback success for ${ip} - ${httpTime}ms`)
      return { alive: true, responseTime: httpTime }
    } catch {
      console.log(`[PING] HTTP fallback also failed for ${ip}`)
      return { alive: false, responseTime: null, error }
    }
  }
}

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
}
