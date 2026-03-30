'use client'
import { useEffect, useState, useCallback } from 'react'

type QRData = {
  token: string
  checkinUrl: string
  qrDataUri: string
  date: string
  expiresAt: string
}

function msUntilMidnight() {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  return midnight.getTime() - now.getTime()
}

export default function QRDisplayPage() {
  const [qrData,    setQrData]    = useState<QRData | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const [time,      setTime]      = useState('')
  const [countdown, setCountdown] = useState('')
  const [loading,   setLoading]   = useState(true)
  const [refreshIn, setRefreshIn] = useState(0)

  const fetchQR = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/qr/daily')
      if (!r.ok) { setError('Failed to load QR code'); return }
      const d: QRData = await r.json()
      setQrData(d)
      setError(null)
      // Schedule auto-refresh at midnight + 5s
      setRefreshIn(Math.ceil(msUntilMidnight() / 1000) + 5)
    } catch {
      setError('Network error — could not load QR code')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => { fetchQR() }, [fetchQR])

  // Live clock + countdown timer
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }))
      const ms = msUntilMidnight()
      const h  = Math.floor(ms / 3_600_000)
      const m  = Math.floor((ms % 3_600_000) / 60_000)
      const s  = Math.floor((ms % 60_000) / 1000)
      setCountdown(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
      setRefreshIn(prev => {
        if (prev <= 1) { fetchQR(); return 0 }
        return prev - 1
      })
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [fetchQR])

  const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0038A8 0%, #001f5c 100%)' }}>

      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-3 bg-white/10 border border-white/20 rounded-2xl px-5 py-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-black text-[var(--dict-blue,#0038A8)] text-xs">DTC</div>
          <span className="text-white font-bold text-sm">DICT Region V — Intern Check-In</span>
        </div>
        <p className="text-blue-200 text-sm">{today}</p>
        <p className="text-white font-mono text-2xl font-bold mt-1">{time}</p>
      </div>

      {/* QR Card */}
      <div className="bg-white rounded-3xl shadow-2xl p-6 flex flex-col items-center" style={{ minWidth: 320 }}>
        {loading ? (
          <div className="w-64 h-64 bg-gray-100 rounded-2xl flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="w-64 h-64 bg-red-50 rounded-2xl flex flex-col items-center justify-center gap-3 p-4 text-center">
            <span className="text-4xl">⚠️</span>
            <p className="text-red-600 font-semibold text-sm">{error}</p>
            <button onClick={fetchQR} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold">Retry</button>
          </div>
        ) : qrData ? (
          <>
            <div className="relative">
              <img src={qrData.qrDataUri} alt="Daily QR Code" className="w-64 h-64 rounded-2xl" />
              <div className="absolute inset-0 rounded-2xl ring-4 ring-blue-100 pointer-events-none" />
            </div>
            <div className="mt-4 text-center">
              <p className="font-black text-gray-900 text-lg">Scan to Time In</p>
              <p className="text-gray-500 text-xs mt-1">Open your phone camera and scan this code</p>
            </div>
          </>
        ) : null}

        {/* Daily badge */}
        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
          <span className="text-blue-700 text-xs font-bold uppercase tracking-widest">Daily Code · Valid Today Only</span>
        </div>
      </div>

      {/* Footer info */}
      <div className="mt-6 text-center space-y-2">
        <div className="flex items-center justify-center gap-6 text-sm text-blue-200">
          <div className="flex items-center gap-2">
            <span>📍</span>
            <span>GPS verification required</span>
          </div>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center gap-2">
            <span>🔒</span>
            <span>Resets in <span className="font-mono font-bold text-white">{countdown}</span></span>
          </div>
        </div>
        <p className="text-blue-300/60 text-xs mt-2">
          Only works within 300m of the DTC office &bull; Requires intern account login
        </p>
      </div>

      {/* Refresh button */}
      <button onClick={fetchQR} className="mt-6 px-5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold rounded-xl transition-colors">
        ↺ Refresh QR Code
      </button>
    </div>
  )
}
