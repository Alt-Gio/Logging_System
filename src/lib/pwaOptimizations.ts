// src/lib/pwaOptimizations.ts
// Advanced PWA optimizations and utilities

// ─── Network Status Detection ─────────────────────────────────────────────────

export function getNetworkStatus(): {
  online: boolean
  effectiveType?: string
  downlink?: number
  rtt?: number
} {
  if (typeof navigator === 'undefined') {
    return { online: true }
  }

  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
  
  return {
    online: navigator.onLine,
    effectiveType: connection?.effectiveType,
    downlink: connection?.downlink,
    rtt: connection?.rtt,
  }
}

// ─── Preload Critical Resources ──────────────────────────────────────────────

export function preloadCriticalResources() {
  if (typeof window === 'undefined') return

  const criticalResources = [
    '/api/settings',
    '/api/pcs',
    '/api/announcements',
  ]

  criticalResources.forEach(url => {
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = url
    document.head.appendChild(link)
  })
}

// ─── Image Optimization ───────────────────────────────────────────────────────

export async function optimizeImage(
  dataUrl: string,
  maxWidth: number = 800,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height

      // Calculate new dimensions
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

// ─── Service Worker Communication ────────────────────────────────────────────

export function sendMessageToSW(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!navigator.serviceWorker?.controller) {
      reject(new Error('No service worker controller'))
      return
    }

    const messageChannel = new MessageChannel()
    messageChannel.port1.onmessage = (event) => {
      if (event.data.error) {
        reject(event.data.error)
      } else {
        resolve(event.data)
      }
    }

    navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2])
  })
}

// ─── Cache Management ─────────────────────────────────────────────────────────

export async function clearOldCaches(keepCaches: string[] = []) {
  if (!('caches' in window)) return

  const cacheNames = await caches.keys()
  const cachesToDelete = cacheNames.filter(name => !keepCaches.includes(name))

  await Promise.all(cachesToDelete.map(name => caches.delete(name)))
  
  return {
    deleted: cachesToDelete.length,
    kept: keepCaches.length,
  }
}

export async function getCacheSize(): Promise<number> {
  if (!('caches' in window)) return 0

  const cacheNames = await caches.keys()
  let totalSize = 0

  for (const name of cacheNames) {
    const cache = await caches.open(name)
    const keys = await cache.keys()
    
    for (const request of keys) {
      const response = await cache.match(request)
      if (response) {
        const blob = await response.blob()
        totalSize += blob.size
      }
    }
  }

  return totalSize
}

// ─── Performance Monitoring ───────────────────────────────────────────────────

export function measurePerformance(metricName: string) {
  if (typeof window === 'undefined' || !window.performance) return

  return {
    start: () => performance.mark(`${metricName}-start`),
    end: () => {
      performance.mark(`${metricName}-end`)
      performance.measure(metricName, `${metricName}-start`, `${metricName}-end`)
      
      const measure = performance.getEntriesByName(metricName)[0]
      return measure?.duration || 0
    },
  }
}

export function getWebVitals() {
  if (typeof window === 'undefined') return null

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
  const paint = performance.getEntriesByType('paint')

  return {
    // First Contentful Paint
    fcp: paint.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
    // Largest Contentful Paint (needs observer)
    // Time to Interactive
    tti: navigation?.domInteractive || 0,
    // Total Blocking Time
    domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart || 0,
    // Page Load Time
    loadTime: navigation?.loadEventEnd - navigation?.fetchStart || 0,
  }
}

// ─── Offline Queue Status ─────────────────────────────────────────────────────

export async function getOfflineQueueStatus() {
  const { getUnsyncedLogs } = await import('./indexedDB')
  const queue = await getUnsyncedLogs()
  
  return {
    count: queue.length,
    oldestTimestamp: queue.length > 0 ? Math.min(...queue.map(e => e.timestamp)) : null,
    totalSize: JSON.stringify(queue).length,
  }
}

// ─── Smart Retry Logic ────────────────────────────────────────────────────────

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

// ─── Battery Status ───────────────────────────────────────────────────────────

export async function getBatteryStatus() {
  if (typeof navigator === 'undefined' || !('getBattery' in navigator)) {
    return null
  }

  try {
    const battery = await (navigator as any).getBattery()
    return {
      charging: battery.charging,
      level: battery.level,
      chargingTime: battery.chargingTime,
      dischargingTime: battery.dischargingTime,
    }
  } catch {
    return null
  }
}

// ─── Adaptive Loading Based on Connection ────────────────────────────────────

export function shouldLoadHighQuality(): boolean {
  const network = getNetworkStatus()
  
  // Load high quality if:
  // 1. Online
  // 2. Good connection (4g or better)
  // 3. Fast downlink (> 1.5 Mbps)
  
  if (!network.online) return false
  
  const goodConnection = network.effectiveType === '4g' || network.effectiveType === '5g'
  const fastDownlink = (network.downlink || 0) > 1.5
  
  return goodConnection || fastDownlink
}

// ─── Install Prompt Handler ───────────────────────────────────────────────────

let deferredPrompt: any = null

export function setupInstallPrompt() {
  if (typeof window === 'undefined') return

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    deferredPrompt = e
  })
}

export async function showInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt) return false

  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  
  deferredPrompt = null
  return outcome === 'accepted'
}

export function canShowInstallPrompt(): boolean {
  return deferredPrompt !== null
}

// ─── Update Notification ──────────────────────────────────────────────────────

export function setupUpdateNotification(onUpdate: () => void) {
  if (typeof window === 'undefined' || !navigator.serviceWorker) return

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    onUpdate()
  })
}

// ─── Prefetch Next Likely Page ───────────────────────────────────────────────

export function prefetchNextPage(url: string) {
  if (typeof window === 'undefined') return

  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.href = url
  link.as = 'document'
  document.head.appendChild(link)
}
