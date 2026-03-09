'use client'
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-8">
      <div className="glass rounded-3xl p-10 max-w-md w-full shadow-2xl">
        <div className="text-6xl mb-6">📡</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-3" style={{fontFamily:"'Sora',sans-serif"}}>
          You&apos;re Offline
        </h1>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          The DTC Logbook needs an internet connection to sync entries. Cached data is still available — reconnect to resume normal operation.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left mb-6">
          <p className="text-xs font-bold text-amber-700 mb-2">📋 Offline Mode</p>
          <ul className="text-xs text-amber-600 space-y-1">
            <li>• Previously loaded pages are available from cache</li>
            <li>• New log entries will queue and sync when back online</li>
            <li>• Dashboard shows last known data</li>
          </ul>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="w-full py-3 bg-[#003082] text-white rounded-2xl font-bold text-sm hover:bg-blue-800 transition-colors"
        >
          🔄 Try Again
        </button>
      </div>
    </div>
  )
}
