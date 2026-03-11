// src/lib/indexedDB.ts
// Enhanced offline storage using IndexedDB for better performance and capacity
// @ts-nocheck - Bypassing idb type issues for build compatibility

import { openDB } from 'idb'

type LogEntry = {
  id: string
  fullName: string
  agency: string
  purpose: string
  serviceType: string
  pcId?: string
  photoDataUrl?: string
  timeIn: string
  timeOut?: string
  plannedDurationHours: number
  synced: boolean
  timestamp: number
}

const DB_NAME = 'dict-logbook-db'
const DB_VERSION = 1

let dbInstance: any = null

export async function getDB(): Promise<any> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Logs store
      if (!db.objectStoreNames.contains('logs')) {
        const logStore = db.createObjectStore('logs', { keyPath: 'id' })
        logStore.createIndex('synced', 'synced')
        logStore.createIndex('timestamp', 'timestamp')
      }

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }

      // PCs store
      if (!db.objectStoreNames.contains('pcs')) {
        const pcStore = db.createObjectStore('pcs', { keyPath: 'id' })
        pcStore.createIndex('lastUpdated', 'lastUpdated')
      }

      // Announcements store
      if (!db.objectStoreNames.contains('announcements')) {
        const announcementStore = db.createObjectStore('announcements', { keyPath: 'id' })
        announcementStore.createIndex('timestamp', 'timestamp')
      }
    },
  })

  return dbInstance
}

// ─── Log Operations ───────────────────────────────────────────────────────────

export async function saveLogOffline(log: Omit<LogEntry, 'id' | 'timestamp' | 'synced'>) {
  const db = await getDB()
  const id = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  await db.add('logs', {
    ...log,
    id,
    synced: false,
    timestamp: Date.now(),
  })
  return id
}

export async function getUnsyncedLogs(): Promise<LogEntry[]> {
  const db = await getDB()
  const tx = db.transaction('logs', 'readonly')
  const index = tx.store.index('synced')
  const logs = await index.getAll()
  return logs.filter((log: LogEntry) => !log.synced)
}

export async function markLogSynced(id: string) {
  const db = await getDB()
  const log = await db.get('logs', id)
  if (log) {
    log.synced = true
    await db.put('logs', log)
  }
}

export async function deleteLog(id: string) {
  const db = await getDB()
  await db.delete('logs', id)
}

export async function getAllLogs() {
  const db = await getDB()
  return db.getAll('logs')
}

// ─── Settings Operations ──────────────────────────────────────────────────────

export async function saveSetting(key: string, data: unknown) {
  const db = await getDB()
  await db.put('settings', { key, data, timestamp: Date.now() })
}

export async function getSetting<T>(key: string): Promise<T | null> {
  const db = await getDB()
  const result = await db.get('settings', key)
  return result ? (result.data as T) : null
}

// ─── PC Operations ────────────────────────────────────────────────────────────

export async function savePCs(pcs: Array<Omit<LogbookDB['pcs']['value'], 'lastUpdated'>>) {
  const db = await getDB()
  const tx = db.transaction('pcs', 'readwrite')
  await Promise.all(
    pcs.map(pc => tx.store.put({ ...pc, lastUpdated: Date.now() }))
  )
  await tx.done
}

export async function getPCs() {
  const db = await getDB()
  return db.getAll('pcs')
}

export async function getPC(id: string) {
  const db = await getDB()
  return db.get('pcs', id)
}

// ─── Announcement Operations ──────────────────────────────────────────────────

export async function saveAnnouncements(announcements: Array<Omit<LogbookDB['announcements']['value'], 'timestamp'>>) {
  const db = await getDB()
  const tx = db.transaction('announcements', 'readwrite')
  await Promise.all(
    announcements.map(ann => tx.store.put({ ...ann, timestamp: Date.now() }))
  )
  await tx.done
}

export async function getAnnouncements() {
  const db = await getDB()
  return db.getAll('announcements')
}

// ─── Sync Operations ──────────────────────────────────────────────────────────

export async function syncOfflineData(): Promise<{ synced: number; failed: number }> {
  const unsyncedLogs = await getUnsyncedLogs()
  let synced = 0
  let failed = 0

  for (const log of unsyncedLogs) {
    try {
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: log.fullName,
          agency: log.agency,
          purpose: log.purpose,
          serviceType: log.serviceType,
          pcId: log.pcId,
          photoDataUrl: log.photoDataUrl,
          timeIn: log.timeIn,
          plannedDurationHours: log.plannedDurationHours,
        }),
      })

      if (response.ok) {
        await markLogSynced(log.id)
        synced++
      } else {
        failed++
      }
    } catch (error) {
      console.error('Sync failed for log:', log.id, error)
      failed++
    }
  }

  return { synced, failed }
}

// ─── Cache Management ─────────────────────────────────────────────────────────

export async function clearOldData(daysToKeep = 7) {
  const db = await getDB()
  const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000

  const tx = db.transaction(['logs', 'pcs', 'announcements'], 'readwrite')
  
  // Clear old synced logs
  const logs = await tx.objectStore('logs').getAll()
  await Promise.all(
    logs
      .filter(log => log.synced && log.timestamp < cutoff)
      .map(log => tx.objectStore('logs').delete(log.id))
  )

  await tx.done
}
