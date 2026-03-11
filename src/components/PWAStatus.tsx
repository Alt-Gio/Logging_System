// src/components/PWAStatus.tsx
'use client'

import { useState, useEffect } from 'react'
import { getNetworkStatus, getCacheSize, getOfflineQueueStatus, canShowInstallPrompt, showInstallPrompt } from '@/lib/pwaOptimizations'

export function PWAStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [cacheSize, setCacheSize] = useState(0)
  const [queueCount, setQueueCount] = useState(0)
  const [showInstallButton, setShowInstallButton] = useState(false)
  const [networkType, setNetworkType] = useState<string>('')
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    updateStatus()
    
    const interval = setInterval(updateStatus, 10000) // Update every 10s
    
    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)
    
    // Check for install prompt
    setShowInstallButton(canShowInstallPrompt())
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('online', updateStatus)
      window.removeEventListener('offline', updateStatus)
    }
  }, [])

  const updateStatus = async () => {
    const network = getNetworkStatus()
    setIsOnline(network.online)
    setNetworkType(network.effectiveType || 'unknown')
    
    try {
      const size = await getCacheSize()
      setCacheSize(size)
      
      const queue = await getOfflineQueueStatus()
      setQueueCount(queue.count)
    } catch (error) {
      console.error('Failed to update PWA status:', error)
    }
  }

  const handleInstall = async () => {
    const accepted = await showInstallPrompt()
    if (accepted) {
      setShowInstallButton(false)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="fixed bottom-4 left-4 z-40">
      {/* Status Indicator */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg transition-all ${
          isOnline ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
        } text-white text-xs font-semibold`}
      >
        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-white animate-pulse' : 'bg-white'}`} />
        {isOnline ? 'Online' : 'Offline'}
        {queueCount > 0 && (
          <span className="bg-white text-red-500 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
            {queueCount}
          </span>
        )}
      </button>

      {/* Details Panel */}
      {showDetails && (
        <div className="absolute bottom-14 left-0 bg-white rounded-2xl shadow-2xl p-4 w-72 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-gray-800">PWA Status</h3>
            <button
              onClick={() => setShowDetails(false)}
              className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            {/* Connection Status */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Connection</span>
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
                {isOnline && networkType && (
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                    {networkType}
                  </span>
                )}
              </div>
            </div>

            {/* Cache Size */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Cache Size</span>
              <span className="font-semibold text-gray-800">{formatBytes(cacheSize)}</span>
            </div>

            {/* Offline Queue */}
            {queueCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-700 font-semibold">Pending Sync</span>
                  <span className="bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {queueCount} {queueCount === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
                <p className="text-[10px] text-amber-600 mt-1">
                  Will sync when connection is restored
                </p>
              </div>
            )}

            {/* Install Button */}
            {showInstallButton && (
              <button
                onClick={handleInstall}
                className="w-full py-2 bg-[var(--dict-blue)] text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
              >
                📱 Install App
              </button>
            )}

            {/* Info */}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 text-center">
                PWA v2.0 • Enhanced Offline Support
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
