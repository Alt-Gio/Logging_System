// public/sw-config.js
// Custom service worker configuration for advanced features

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...')
  event.waitUntil(self.clients.claim())
})

// Background Sync for offline form submissions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-logs') {
    event.waitUntil(syncOfflineLogs())
  }
})

async function syncOfflineLogs() {
  try {
    const db = await openIndexedDB()
    const logs = await getUnsyncedLogs(db)
    
    for (const log of logs) {
      try {
        const response = await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(log.payload),
        })
        
        if (response.ok) {
          await markLogSynced(db, log.id)
        }
      } catch (error) {
        console.error('[SW] Failed to sync log:', error)
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error)
  }
}

// Push Notifications (for future use)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  
  const options = {
    body: data.body || 'New notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: data,
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'DICT DTC Logbook', options)
  )
})

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  )
})

// Message Handler for communication with main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: '2.0.0' })
  }
})

// Helper functions
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('dict-logbook-db', 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function getUnsyncedLogs(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['logs'], 'readonly')
    const store = transaction.objectStore('logs')
    const index = store.index('synced')
    const request = index.getAll(0)
    
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function markLogSynced(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['logs'], 'readwrite')
    const store = transaction.objectStore('logs')
    const request = store.get(id)
    
    request.onsuccess = () => {
      const log = request.result
      if (log) {
        log.synced = true
        const updateRequest = store.put(log)
        updateRequest.onsuccess = () => resolve()
        updateRequest.onerror = () => reject(updateRequest.error)
      } else {
        resolve()
      }
    }
    request.onerror = () => reject(request.error)
  })
}
