// src/lib/network-scanner.ts
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface ScanResult {
  ip: string
  hostname: string | null
  alive: boolean
  responseTime: number | null
}

/**
 * Ping a single IP address
 */
export async function pingHost(ip: string, timeout = 1000): Promise<ScanResult> {
  const start = Date.now()
  try {
    const isWindows = process.platform === 'win32'
    const cmd = isWindows
      ? `ping -n 1 -w ${timeout} ${ip}`
      : `ping -c 1 -W 1 ${ip}`

    await execAsync(cmd)
    const responseTime = Date.now() - start

    // Try to get hostname
    let hostname: string | null = null
    try {
      const { stdout } = await execAsync(`nslookup ${ip}`)
      const match = stdout.match(/name\s*=\s*(.+)/i)
      hostname = match ? match[1].trim() : null
    } catch {
      hostname = null
    }

    return { ip, hostname, alive: true, responseTime }
  } catch {
    return { ip, hostname: null, alive: false, responseTime: null }
  }
}

/**
 * Scan an IP range concurrently (e.g., 192.168.1.1 to 192.168.1.254)
 */
export async function scanRange(
  baseIp: string,
  startOctet: number = 1,
  endOctet: number = 254,
  concurrency: number = 30
): Promise<ScanResult[]> {
  const ips: string[] = []
  for (let i = startOctet; i <= endOctet; i++) {
    ips.push(`${baseIp}.${i}`)
  }

  const results: ScanResult[] = []

  // Process in batches for concurrency control
  for (let i = 0; i < ips.length; i += concurrency) {
    const batch = ips.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(ip => pingHost(ip)))
    results.push(...batchResults)
  }

  return results.filter(r => r.alive)
}

/**
 * Get the server's local IP range for scanning
 */
export async function getLocalNetwork(): Promise<string> {
  try {
    const { networkInterfaces } = await import('os')
    const nets = networkInterfaces()

    for (const iface of Object.values(nets)) {
      if (!iface) continue
      for (const net of iface) {
        if (net.family === 'IPv4' && !net.internal) {
          const parts = net.address.split('.')
          return `${parts[0]}.${parts[1]}.${parts[2]}`
        }
      }
    }
  } catch {}

  return '192.168.1'
}

/**
 * Get MAC address of a host (Linux/Windows)
 */
export async function getMacAddress(ip: string): Promise<string | null> {
  try {
    await pingHost(ip) // ensure ARP cache is populated
    const { stdout } = await execAsync(`arp -n ${ip}`)
    const match = stdout.match(/([0-9a-f]{2}[:-]){5}[0-9a-f]{2}/i)
    return match ? match[0] : null
  } catch {
    return null
  }
}
