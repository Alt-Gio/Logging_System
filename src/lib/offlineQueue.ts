// src/lib/offlineQueue.ts
// Queues log entries when offline and syncs when connection is restored

const QUEUE_KEY = 'dtc_offline_queue'

type QueuedEntry = {
  id: string
  payload: Record<string, unknown>
  timestamp: number
}

export function enqueueOfflineLog(payload: Record<string, unknown>): string {
  const id = `offline_${Date.now()}_${Math.random().toString(36).slice(2,7)}`
  try {
    const existing = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') as QueuedEntry[]
    existing.push({ id, payload, timestamp: Date.now() })
    localStorage.setItem(QUEUE_KEY, JSON.stringify(existing))
  } catch {}
  return id
}

export function getOfflineQueue(): QueuedEntry[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  } catch {
    return []
  }
}

export function clearQueueEntry(id: string) {
  try {
    const q = getOfflineQueue().filter(e => e.id !== id)
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  } catch {}
}

export function clearEntireQueue() {
  try { localStorage.removeItem(QUEUE_KEY) } catch {}
}

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  const queue = getOfflineQueue()
  if (!queue.length) return { synced: 0, failed: 0 }

  let synced = 0, failed = 0
  for (const entry of queue) {
    try {
      const r = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry.payload),
      })
      if (r.ok) { clearQueueEntry(entry.id); synced++ }
      else failed++
    } catch {
      failed++
    }
  }
  return { synced, failed }
}
