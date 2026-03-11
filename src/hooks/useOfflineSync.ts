// src/hooks/useOfflineSync.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import { syncOfflineData } from '@/lib/indexedDB'

export function useOfflineSync() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [syncResult, setSyncResult] = useState<{ synced: number; failed: number } | null>(null)

  const performSync = useCallback(async () => {
    if (isSyncing) return

    setIsSyncing(true)
    try {
      const result = await syncOfflineData()
      setSyncResult(result)
      setLastSyncTime(new Date())
      
      if (result.synced > 0) {
        console.log(`✅ Synced ${result.synced} offline entries`)
      }
      
      return result
    } catch (error) {
      console.error('Sync failed:', error)
      return { synced: 0, failed: 0 }
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing])

  useEffect(() => {
    // Auto-sync when coming back online
    const handleOnline = () => {
      console.log('🌐 Connection restored, syncing offline data...')
      performSync()
    }

    window.addEventListener('online', handleOnline)

    // Initial sync on mount if online
    if (navigator.onLine) {
      performSync()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [performSync])

  return {
    isSyncing,
    lastSyncTime,
    syncResult,
    performSync,
  }
}
