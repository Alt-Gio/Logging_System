// src/hooks/useNetworkStatus.ts
'use client'

import { useState, useEffect } from 'react'
import { getNetworkStatus } from '@/lib/pwaOptimizations'

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [networkType, setNetworkType] = useState<string>('')
  const [downlink, setDownlink] = useState<number>(0)

  useEffect(() => {
    const updateStatus = () => {
      const status = getNetworkStatus()
      setIsOnline(status.online)
      setNetworkType(status.effectiveType || '')
      setDownlink(status.downlink || 0)
    }

    updateStatus()

    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)

    // Listen for connection changes
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
    if (connection) {
      connection.addEventListener('change', updateStatus)
    }

    return () => {
      window.removeEventListener('online', updateStatus)
      window.removeEventListener('offline', updateStatus)
      if (connection) {
        connection.removeEventListener('change', updateStatus)
      }
    }
  }, [])

  return {
    isOnline,
    networkType,
    downlink,
    isSlowConnection: networkType === '2g' || networkType === 'slow-2g',
    isFastConnection: networkType === '4g' || networkType === '5g',
  }
}
