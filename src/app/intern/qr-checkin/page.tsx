'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

type CheckInState = 'idle' | 'locating' | 'map_ready' | 'in_range' | 'out_range' | 'auth' | 'submitting' | 'success' | 'error' | 'already_active' | 'expired'

type MapConfig = {
  officeLat: number
  officeLng: number
  radiusM:   number
  token:     string
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R  = 6_371_000
  const d1 = (lat2 - lat1) * Math.PI / 180
  const d2 = (lng2 - lng1) * Math.PI / 180
  const a  = Math.sin(d1 / 2) ** 2 +
             Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(d2 / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function buildCircleGeoJSON(lat: number, lng: number, radiusM: number) {
  const points = 64
  const coords: [number, number][] = []
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI
    const dLat  = (radiusM / 111_320) * Math.cos(angle)
    const dLng  = (radiusM / (111_320 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle)
    coords.push([lng + dLng, lat + dLat])
  }
  return { type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [coords] }, properties: {} }
}

export default function QRCheckinPage() {
  const params = useSearchParams()
  const token  = params.get('token') ?? ''

  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<unknown>(null)

  const [state,       setState]       = useState<CheckInState>('idle')
  const [userLat,     setUserLat]     = useState<number | null>(null)
  const [userLng,     setUserLng]     = useState<number | null>(null)
  const [distanceM,   setDistanceM]   = useState<number | null>(null)
  const [mapCfg,      setMapCfg]      = useState<MapConfig | null>(null)
  const [gpsError,    setGpsError]    = useState<string | null>(null)
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [authErr,     setAuthErr]     = useState<string | null>(null)
  const [successMsg,  setSuccessMsg]  = useState('')
  const [errorMsg,    setErrorMsg]    = useState('')
  const [sessionExists, setSessionExists] = useState(false)

  // Check for existing intern session cookie
  useEffect(() => {
    fetch('/api/intern-auth/session').then(r => r.json()).then(d => {
      if (d?.internId) setSessionExists(true)
    }).catch(() => {})
  }, [])

  // Validate token existence
  useEffect(() => {
    if (!token) { setState('expired'); return }
    const datePart = token.split('_')[0]
    if (!datePart || datePart.length !== 8) { setState('expired'); return }
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    if (datePart !== `${y}${m}${d}`) setState('expired')
  }, [token])

  // Fetch office settings
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then((s: Record<string, string>) => {
      setMapCfg({
        officeLat: parseFloat(s.office_lat ?? '13.1391'),
        officeLng: parseFloat(s.office_lng ?? '123.7438'),
        radiusM:   parseInt(s.checkin_radius_m ?? '300', 10),
        token:     s.mapbox_token ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '',
      })
    }).catch(() => {
      setMapCfg({ officeLat: 13.1391, officeLng: 123.7438, radiusM: 300, token: '' })
    })
  }, [])

  const initMap = useCallback(async (lat: number, lng: number, cfg: MapConfig) => {
    if (!mapContainer.current || mapRef.current) return
    try {
      const maplibregl = (await import('maplibre-gl')).default

      const styleUrl = cfg.token
        ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${cfg.token}`
        : 'https://demotiles.maplibre.org/style.json'

      const map = new maplibregl.Map({
        container:  mapContainer.current!,
        style:      styleUrl,
        center:     [lng, lat],
        zoom:       16,
        attributionControl: false,
      })

      mapRef.current = map

      map.on('load', () => {
        // Radius circle
        const circleGJ = buildCircleGeoJSON(cfg.officeLat, cfg.officeLng, cfg.radiusM)
        const dist     = Math.round(haversineMeters(lat, lng, cfg.officeLat, cfg.officeLng))
        const inRange  = dist <= cfg.radiusM

        map.addSource('radius', { type: 'geojson', data: circleGJ })
        map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius', paint: { 'fill-color': inRange ? '#10b981' : '#ef4444', 'fill-opacity': 0.12 } })
        map.addLayer({ id: 'radius-line', type: 'line', source: 'radius', paint: { 'line-color': inRange ? '#10b981' : '#ef4444', 'line-width': 2 } })

        // Office marker
        const officeEl = document.createElement('div')
        officeEl.innerHTML = `<div style="background:#0038A8;color:white;border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 2px 12px rgba(0,56,168,.4);border:3px solid white">🏢</div>`
        new maplibregl.Marker({ element: officeEl }).setLngLat([cfg.officeLng, cfg.officeLat]).addTo(map)

        // User marker
        const userEl = document.createElement('div')
        const col = inRange ? '#10b981' : '#ef4444'
        userEl.innerHTML = `<div style="background:${col};color:white;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 12px ${col}66;border:3px solid white">📍</div>`
        new maplibregl.Marker({ element: userEl }).setLngLat([lng, lat]).addTo(map)

        setState(inRange ? 'in_range' : 'out_range')
        setDistanceM(dist)
      })
    } catch (err) {
      console.error('Map init error:', err)
      // Map failed but we can still check-in using coordinates
      const dist = Math.round(haversineMeters(lat, lng, cfg.officeLat, cfg.officeLng))
      setDistanceM(dist)
      setState(dist <= cfg.radiusM ? 'in_range' : 'out_range')
    }
  }, [])

  const startLocating = useCallback(() => {
    setState('locating')
    setGpsError(null)
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.')
      setState('idle')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setUserLat(lat)
        setUserLng(lng)
        setState('map_ready')
        if (mapCfg) initMap(lat, lng, mapCfg)
      },
      err => {
        const msgs: Record<number, string> = {
          1: 'Location permission denied. Please allow GPS access and try again.',
          2: 'Location unavailable. Please ensure GPS is enabled.',
          3: 'Location request timed out. Please try again.',
        }
        setGpsError(msgs[err.code] ?? 'Could not determine your location.')
        setState('idle')
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  }, [mapCfg, initMap])

  // Wait for mapCfg then locate
  useEffect(() => {
    if (mapCfg && state === 'idle' && token && !token.startsWith('expired')) startLocating()
  }, [mapCfg]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCheckIn() {
    if (state !== 'in_range' && state !== 'auth') return
    if (!sessionExists && (!email.trim() || !password)) {
      setAuthErr('Email and password are required.')
      return
    }
    setState('submitting')
    setAuthErr(null)
    try {
      const body: Record<string, unknown> = { token, lat: userLat, lng: userLng }
      if (!sessionExists) { body.email = email; body.password = password }

      const res  = await fetch('/api/intern-sessions/qr-checkin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json()

      if (res.status === 409) { setState('already_active'); return }
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Check-in failed.')
        setState('error')
        return
      }
      setSuccessMsg(`Welcome, ${data.internName ?? 'intern'}! You are now timed in. 🎉`)
      setState('success')
    } catch {
      setErrorMsg('Network error. Please try again.')
      setState('error')
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  if (state === 'expired') {
    return (
      <Screen title="QR Code Expired" icon="⏳" color="from-amber-500 to-orange-600">
        <p className="text-white/90 text-sm leading-relaxed">This QR code is from a previous day and is no longer valid.</p>
        <p className="text-white/70 text-sm mt-2">Please scan today&apos;s QR code from the DTC display screen.</p>
        <Link href="/intern/dashboard" className="mt-6 block text-center px-6 py-3 bg-white text-amber-600 rounded-2xl font-bold text-sm">← Back to Dashboard</Link>
      </Screen>
    )
  }

  if (state === 'success') {
    return (
      <Screen title="Timed In!" icon="✅" color="from-emerald-500 to-green-700">
        <p className="text-white/90 text-sm leading-relaxed">{successMsg}</p>
        {distanceM != null && <p className="text-emerald-200 text-xs mt-2">📍 {distanceM}m from DTC office · Verified via GPS</p>}
        <Link href="/intern/dashboard" className="mt-6 block text-center px-6 py-3 bg-white text-emerald-700 rounded-2xl font-bold text-sm">View Dashboard</Link>
      </Screen>
    )
  }

  if (state === 'already_active') {
    return (
      <Screen title="Already Timed In" icon="🟡" color="from-yellow-500 to-amber-600">
        <p className="text-white/90 text-sm">You already have an active session today.</p>
        <Link href="/intern/dashboard" className="mt-6 block text-center px-6 py-3 bg-white text-amber-600 rounded-2xl font-bold text-sm">View Dashboard</Link>
      </Screen>
    )
  }

  return (
    <div className="min-h-screen bg-[#070e1b] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom,0px)' }}>

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[.06]" style={{ background: 'rgba(7,14,27,.95)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center font-black text-xs text-white">DTC</div>
          <div>
            <p className="font-bold text-white text-sm">QR Check-In</p>
            <p className="text-gray-500 text-xs">DICT Region V · Intern Portal</p>
          </div>
          <Link href="/intern/dashboard" className="ml-auto text-gray-500 hover:text-gray-300 text-xs transition-colors">← Dashboard</Link>
        </div>
      </div>

      {/* Map */}
      <div className="relative flex-1" style={{ minHeight: 280, maxHeight: 380 }}>
        <div ref={mapContainer} className="absolute inset-0" />

        {/* Overlay states */}
        {(state === 'idle' || state === 'locating') && (
          <div className="absolute inset-0 bg-[#070e1b] flex flex-col items-center justify-center gap-4">
            {state === 'locating' ? (
              <>
                <div className="w-14 h-14 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-white font-semibold">Getting your location…</p>
                <p className="text-gray-400 text-xs text-center px-8">Please allow location access when prompted</p>
              </>
            ) : (
              <>
                <span className="text-5xl">📍</span>
                <p className="text-white font-semibold">Location Required</p>
                {gpsError && <p className="text-red-400 text-xs text-center px-8">{gpsError}</p>}
                <button onClick={startLocating} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm">
                  📍 Allow Location Access
                </button>
              </>
            )}
          </div>
        )}

        {/* Distance badge */}
        {distanceM != null && (state === 'in_range' || state === 'out_range' || state === 'auth' || state === 'submitting') && (
          <div className={`absolute top-3 inset-x-3 rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-lg ${state === 'out_range' ? 'bg-red-600/90' : 'bg-emerald-600/90'}`}>
            <span className="text-white text-xl">{state === 'out_range' ? '🚫' : '✅'}</span>
            <div>
              <p className="text-white font-bold text-sm">{state === 'out_range' ? 'Too Far Away' : 'Within Range'}</p>
              <p className="text-white/80 text-xs">{distanceM}m from DTC office (max {mapCfg?.radiusM ?? 300}m)</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div className="px-4 py-5 space-y-4" style={{ background: 'rgba(7,14,27,.97)' }}>

        {state === 'out_range' && (
          <div className="bg-red-900/40 border border-red-500/30 rounded-2xl p-4 text-center">
            <p className="text-red-300 font-semibold text-sm mb-1">You are too far from the DTC office</p>
            <p className="text-red-400/70 text-xs">Move within {mapCfg?.radiusM ?? 300}m to check in via QR. You are currently {distanceM}m away.</p>
            <button onClick={startLocating} className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl">↺ Update Location</button>
          </div>
        )}

        {(state === 'in_range') && (
          <div className="bg-emerald-900/30 border border-emerald-500/25 rounded-2xl p-4 text-center">
            <p className="text-emerald-300 font-semibold text-sm">📍 Location Verified — {distanceM}m from DTC Office</p>
            <p className="text-emerald-400/60 text-xs mt-0.5">GPS check passed. Ready to check in.</p>
          </div>
        )}

        {/* Auth form — shown if not already logged in */}
        {(state === 'in_range' || state === 'auth') && !sessionExists && (
          <div className="space-y-3">
            <p className="text-gray-400 text-xs uppercase tracking-widest font-semibold">Intern Login</p>
            {authErr && <p className="text-red-400 text-xs bg-red-900/30 border border-red-500/20 rounded-xl px-3 py-2">{authErr}</p>}
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              autoComplete="email"
              className="w-full bg-white/[.06] border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full bg-white/[.06] border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        {sessionExists && (state === 'in_range') && (
          <div className="bg-blue-900/30 border border-blue-500/20 rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">👤</span>
            <div>
              <p className="text-blue-200 font-semibold text-sm">You&apos;re logged in</p>
              <p className="text-blue-400/70 text-xs">Your session will be used automatically</p>
            </div>
          </div>
        )}

        {/* Check-in button */}
        {(state === 'in_range') && (
          <button onClick={handleCheckIn}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-base rounded-2xl transition-colors shadow-lg"
            style={{ boxShadow: '0 0 0 1px rgba(59,130,246,.4),0 8px 24px rgba(59,130,246,.25)' }}>
            🕐 Time In Now
          </button>
        )}

        {state === 'submitting' && (
          <div className="w-full py-4 bg-blue-600/50 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Checking in…
          </div>
        )}

        {state === 'error' && (
          <div className="bg-red-900/40 border border-red-500/30 rounded-2xl p-4">
            <p className="text-red-300 font-semibold text-sm mb-1">⚠ Check-In Failed</p>
            <p className="text-red-400/80 text-xs">{errorMsg}</p>
            <button onClick={() => setState('in_range')} className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl">Try Again</button>
          </div>
        )}

        <p className="text-gray-700 text-xs text-center">
          Powered by DICT DTC Intern System · GPS-verified QR Check-In
        </p>
      </div>
    </div>
  )
}

function Screen({ title, icon, color, children }: { title: string; icon: string; color: string; children: ReactNode }) {
  return (
    <div className={`min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-br ${color}`}>
      <div className="text-center max-w-sm w-full">
        <div className="text-6xl mb-4">{icon}</div>
        <h1 className="text-white font-black text-2xl mb-2">{title}</h1>
        {children}
      </div>
    </div>
  )
}
