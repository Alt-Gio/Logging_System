'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { GovSeal, GovHeaderLogos } from '@/components/GovernmentHeader'
import { VoiceAssistant } from '@/components/VoiceAssistant'
import { PCCountModal } from '@/components/PCCountModal'
import { format, addHours, setHours, setMinutes, setSeconds } from 'date-fns'
import { syncOfflineData, saveSetting, getSetting } from '@/lib/indexedDB'

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY_AUTH = 'dtc_access_granted'
const STORAGE_KEY_SETTINGS = 'dtc_settings_cache'

const PURPOSE_SUGGESTIONS = [
  'Online Job Application',
  'Government Transaction (e-Gov)',
  'PhilSys / National ID Registration',
  'SSS / GSIS / Pag-IBIG Online Transaction',
  'PhilHealth Online Transaction',
  'Online Scholarship Application',
  'School / University Enrollment',
  'Research and Information Gathering',
  'Resume / CV Preparation',
  'Email and Communication',
  'Online Business Transaction',
  'Freelance Work',
  'Digital Literacy / Learning',
  'Video / Online Meeting',
  'Printing / Document Processing',
  'Other Government Services',
]

const PC_TERMS = [
  'I will treat the computer equipment with utmost care and report any damage immediately.',
  'I will not install unauthorized software or make changes to system settings.',
  'I will not access illegal, inappropriate, or malicious websites or content.',
  'I will log out of all accounts before leaving the workstation.',
  'I understand that session time is limited and I will vacate the workstation on time.',
]

const WIFI_TERMS = [
  'I will use the free WiFi connection responsibly and for lawful purposes only.',
  'I will not use the connection for downloading illegal content or torrenting.',
  'I will not attempt to access unauthorized networks or systems.',
  'I understand that internet usage may be monitored for security purposes.',
  'I will not share or redistribute the WiFi credentials to unauthorized persons.',
]

// ─── Types ────────────────────────────────────────────────────────────────────
type PCStatus = 'ONLINE' | 'OFFLINE' | 'IN_USE' | 'MAINTENANCE'
type PC = {
  id: string; name: string; ipAddress: string
  location: string | null; status: PCStatus; lastSeen: string | null
  icon?: string | null; gridCol?: number | null; gridRow?: number | null
  logs?: { id: string; fullName: string; timeIn: string; photoDataUrl?: string | null; plannedDurationHours?: number }[]
}
type Settings = {
  wifiSsid: string; wifiPassword: string; wifiNote: string
  accessCode: string; officeOpen: string; officeClose: string
  bgImageUrl?: string; interactiveBannerUrl?: string
}
type Announcement = {
  id: string; title: string; body: string
  type: 'INFO' | 'WARNING' | 'MAINTENANCE' | 'HOLIDAY'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return { h: h || 0, m: m || 0 }
}
function getOfficeState(now: Date, open: string, close: string): 'closed' | 'open' | 'closing_soon' {
  const o = parseTime(open), c = parseTime(close)
  const total = now.getHours() * 60 + now.getMinutes()
  const openM = o.h * 60 + o.m, closeM = c.h * 60 + c.m
  if (total < openM || total >= closeM) return 'closed'
  if (closeM - total <= 30) return 'closing_soon'
  return 'open'
}
function getMaxDurationHours(now: Date, close: string): number {
  const c = parseTime(close)
  const closeDate = setSeconds(setMinutes(setHours(new Date(now), c.h), c.m), 0)
  const diffMs = closeDate.getTime() - now.getTime()
  return Math.max(0.25, Math.floor((diffMs / 3600000) * 4) / 4)
}
function closingAt(close: string): string {
  const c = parseTime(close); const d = new Date(); d.setHours(c.h, c.m, 0, 0)
  return format(d, 'h:mm a')
}
function timeToDate(hhmm: string, base: Date): Date {
  const { h, m } = parseTime(hhmm)
  return setSeconds(setMinutes(setHours(new Date(base), h), m), 0)
}
function sanitizeName(val: string): string {
  // Allow letters, spaces, hyphens, periods (for initials), apostrophes
  return val.replace(/[^a-zA-ZÀ-ÖØ-öø-ÿ\s.\-']/g, '')
}
function sanitizeAgency(val: string): string {
  // Allow letters, numbers, spaces, common punctuation
  return val.replace(/[^a-zA-Z0-9\s.\-&,'()\/]/g, '')
}
function wifiQrUrl(ssid: string, password: string): string {
  const data = password ? `WIFI:T:WPA;S:${ssid};P:${password};;` : `WIFI:T:nopass;S:${ssid};;;`
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`
}

// ─── Data Privacy Act Modal ────────────────────────────────────────────────────
function DataPrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(16px)', backgroundColor: 'rgba(0,20,80,0.65)' }}>
      <div className="glass rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="bg-[var(--dict-blue)] text-white rounded-t-2xl px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-display font-bold text-lg">Data Privacy Act of 2012</h3>
            <p className="text-blue-200 text-xs">Republic Act No. 10173</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">✕</button>
        </div>
        <div className="overflow-y-auto p-6 text-sm text-gray-600 space-y-4 flex-1">
          <p className="font-semibold text-gray-800">Your Rights Under RA 10173</p>
          <p>The Department of Information and Communications Technology (DICT) Region V is committed to protecting your personal information in accordance with the Data Privacy Act of 2012.</p>
          <div className="bg-blue-50 rounded-xl p-4 space-y-2">
            <p className="font-semibold text-[var(--dict-blue)]">Information We Collect:</p>
            <ul className="space-y-1 text-xs list-disc list-inside">
              <li>Full name and agency/organization</li>
              <li>Purpose of visit and services availed</li>
              <li>Time in and time out records</li>
              <li>Optional facial photo for identification</li>
              <li>ICT equipment or internet service used</li>
            </ul>
          </div>
          <div className="bg-green-50 rounded-xl p-4 space-y-2">
            <p className="font-semibold text-green-700">How We Use Your Data:</p>
            <ul className="space-y-1 text-xs list-disc list-inside">
              <li>Monitoring and reporting on DTC service delivery</li>
              <li>Security and safety of equipment and premises</li>
              <li>Statistical reporting to DICT central office</li>
              <li>Improvement of government digital services</li>
            </ul>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 space-y-2">
            <p className="font-semibold text-amber-700">Your Rights:</p>
            <ul className="space-y-1 text-xs list-disc list-inside">
              <li><strong>Right to be informed</strong> — you know what data we collect</li>
              <li><strong>Right to access</strong> — you may request a copy of your data</li>
              <li><strong>Right to object</strong> — you may decline non-essential data collection</li>
              <li><strong>Right to erasure</strong> — you may request deletion of your data</li>
              <li><strong>Right to rectification</strong> — you may correct inaccurate data</li>
            </ul>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="font-semibold text-gray-700 mb-1">Data Retention:</p>
            <p className="text-xs">Logbook records are retained for a maximum of one (1) year from the date of collection, after which they are securely disposed of in accordance with DICT records management policies.</p>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="font-semibold text-gray-700 mb-1">Contact Our Data Protection Officer:</p>
            <p className="text-xs text-gray-500">DICT Region V — Digital Transformation Center</p>
            <p className="text-xs text-gray-500">Legazpi City, Albay 4500</p>
            <p className="text-xs text-gray-500">📧 region5@dict.gov.ph</p>
            <p className="text-xs text-gray-500">📞 (052) 742-5670</p>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="w-full py-3 bg-[var(--dict-blue)] text-white rounded-xl font-semibold text-sm hover:bg-blue-800 transition-colors">
            I Understand — Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Terms Checkbox Block ──────────────────────────────────────────────────────
function TermsBlock({ title, icon, color, terms, checked, onChange }: {
  title: string; icon: string; color: string
  terms: string[]; checked: boolean[]; onChange: (i: number, v: boolean) => void
}) {
  const allChecked = checked.every(Boolean)
  return (
    <div className={`rounded-2xl border-2 ${allChecked ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'} p-4 space-y-3 transition-all`}>
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className={`font-semibold text-sm ${color}`}>{title}</span>
        {allChecked && <span className="ml-auto text-xs text-green-600 font-semibold bg-green-100 px-2 py-0.5 rounded-full">✓ Agreed</span>}
      </div>
      {terms.map((term, i) => (
        <label key={i} className="flex items-start gap-3 cursor-pointer group">
          <div onClick={() => onChange(i, !checked[i])}
            className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              checked[i] ? 'bg-[var(--dict-blue)] border-[var(--dict-blue)]' : 'border-gray-300 group-hover:border-blue-300'
            }`}>
            {checked[i] && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
            </svg>}
          </div>
          <span className="text-xs text-gray-600 leading-relaxed">{term}</span>
        </label>
      ))}
    </div>
  )
}

// ─── Duration Picker ───────────────────────────────────────────────────────────
function DurationPicker({ now, maxDuration, officeCloseStr, usageDuration, setUsageDuration, customDuration, setCustomDuration, showCustom, setShowCustom }: {
  now: Date; maxDuration: number; officeCloseStr: string
  usageDuration: string; setUsageDuration: (v: string) => void
  customDuration: string; setCustomDuration: (v: string) => void
  showCustom: boolean; setShowCustom: (v: boolean) => void
}) {
  const presets = [
    { label: '30 min', value: '0.5' }, { label: '1 hr', value: '1' },
    { label: '2 hrs', value: '2' }, { label: '3 hrs', value: '3' },
    { label: 'Other', value: 'custom' },
  ].filter(p => p.value === 'custom' || parseFloat(p.value) <= maxDuration)

  const getMaxTime = () => {
    const d = new Date(now); d.setHours(d.getHours() + Math.floor(maxDuration)); d.setMinutes((maxDuration % 1) * 60)
    return format(d, 'HH:mm')
  }
  const handleEndTime = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [h, m] = e.target.value.split(':').map(Number)
    const end = setSeconds(setMinutes(setHours(new Date(now), h), m), 0)
    const diff = (end.getTime() - now.getTime()) / 3600000
    if (diff > 0 && diff <= maxDuration) setCustomDuration(String(Math.round(diff * 4) / 4))
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2">
        {presets.map(p => (
          <button key={p.value} type="button" onClick={() => { if (p.value === 'custom') { setShowCustom(true); setUsageDuration('custom') } else { setShowCustom(false); setUsageDuration(p.value) } }}
            className={`py-2.5 rounded-xl border text-xs font-semibold transition-all ${
              (p.value === 'custom' ? showCustom : usageDuration === p.value && !showCustom)
                ? 'bg-[var(--dict-blue)] text-white border-[var(--dict-blue)]' : 'border-gray-200 text-gray-600 hover:border-blue-300'
            }`}>
            {p.label}
          </button>
        ))}
      </div>
      {showCustom && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
          <label className="text-xs font-semibold text-gray-500 block">I plan to leave at:</label>
          <input type="time" min={format(now, 'HH:mm')} max={getMaxTime()} onChange={handleEndTime}
            className="w-full border border-blue-200 bg-white rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-[var(--dict-blue)]"/>
          {customDuration && (
            <p className="text-xs text-blue-600">
              ≈ {parseFloat(customDuration).toFixed(2).replace(/\.00$/, '')} hours
              {parseFloat(customDuration) >= maxDuration && <span className="text-amber-600 ml-2">⚠ Capped at {officeCloseStr}</span>}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Small helpers ─────────────────────────────────────────────────────────────
function SRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`font-semibold text-sm ${highlight ? 'text-[var(--dict-blue)]' : 'text-gray-800'}`}>{value}</span>
    </div>
  )
}
function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label} {required && <span className="text-[var(--dict-red)]">*</span>}
      </label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><span>⚠</span>{error}</p>}
    </div>
  )
}
function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}
function iCls(err: boolean) {
  return `w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all ${
    err ? 'border-red-400 bg-red-50 focus:ring-2 focus:ring-red-100'
        : 'border-gray-200 focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-50'
  }`
}

// ─── Interactive Banner (mouse-parallax 3D card) ─────────────────────────────
function InteractiveBanner({ src }: { src: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [glare, setGlare] = useState({ x: 50, y: 50 })
  const [hovered, setHovered] = useState(false)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width   // 0–1
    const py = (e.clientY - rect.top)  / rect.height  // 0–1
    // tilt: max ±18 degrees
    setTilt({ x: (py - 0.5) * -18, y: (px - 0.5) * 18 })
    setGlare({ x: px * 100, y: py * 100 })
  }
  const handleMouseLeave = () => {
    setHovered(false)
    setTilt({ x: 0, y: 0 })
    setGlare({ x: 50, y: 50 })
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: '800px',
        cursor: 'crosshair',
      }}
      className="w-full rounded-2xl overflow-hidden"
    >
      <div style={{
        transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${hovered ? 1.04 : 1})`,
        transition: hovered ? 'transform 0.08s ease-out' : 'transform 0.4s ease-out',
        transformStyle: 'preserve-3d',
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: hovered
          ? `0 20px 60px rgba(0,30,100,0.35), 0 0 0 1px rgba(255,255,255,0.1)`
          : `0 4px 24px rgba(0,30,100,0.15)`,
      }}>
        {/* Banner image */}
        <img
          src={src}
          alt="DTC Interactive Banner"
          draggable={false}
          style={{
            width: '100%',
            display: 'block',
            userSelect: 'none',
            minHeight: '120px',
            objectFit: 'cover',
          }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />

        {/* Moving glare layer */}
        <div
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,${hovered ? 0.22 : 0}) 0%, transparent 60%)`,
            transition: hovered ? 'background 0.08s' : 'background 0.4s',
            borderRadius: '16px',
          }}
        />

        {/* Edge shimmer */}
        {hovered && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '16px', pointerEvents: 'none',
            boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.25)',
          }}/>
        )}
      </div>
    </div>
  )
}

// ─── Session Auto-Timeout (client-side countdown) ─────────────────────────────
function SessionTimer({
  logId, plannedDurationHours, timeIn, officeCloseStr, onTimeout,
}: {
  logId: string; plannedDurationHours: number; timeIn: string
  officeCloseStr: string; onTimeout: () => void
}) {
  const [minsLeft, setMinsLeft] = useState<number | null>(null)
  const [warning, setWarning]   = useState(false)
  const timedOut = useRef(false)

  useEffect(() => {
    const sessionEnd = new Date(new Date(timeIn).getTime() + plannedDurationHours * 3600000)

    // Also compute office close time for today
    const [ch, cm] = officeCloseStr.replace(' PM','').replace(' AM','').split(':').map(Number)
    const isPM = officeCloseStr.includes('PM') && ch !== 12
    const closeHour = isPM ? ch + 12 : ch
    const closeToday = new Date(); closeToday.setHours(closeHour, cm, 0, 0)

    // Effective end is the earlier of planned session end and office close
    const effectiveEnd = sessionEnd < closeToday ? sessionEnd : closeToday

    const tick = () => {
      const now = new Date()
      const msLeft = effectiveEnd.getTime() - now.getTime()
      const mins = Math.ceil(msLeft / 60000)
      setMinsLeft(mins)
      setWarning(mins <= 10 && mins > 0)

      if (msLeft <= 0 && !timedOut.current) {
        timedOut.current = true
        // PATCH the log entry to set timeOut = now
        fetch(`/api/logs/${logId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeOut: new Date().toISOString() }),
        }).catch(() => {})
        onTimeout()
      }
    }

    tick()
    const t = setInterval(tick, 10000) // check every 10s
    return () => clearInterval(t)
  }, [logId, plannedDurationHours, timeIn, officeCloseStr, onTimeout])

  if (minsLeft === null || minsLeft <= 0) return null

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 transition-all ${
      warning ? 'bg-red-50 border-red-300 animate-pulse' : 'bg-amber-50 border-amber-200'
    }`}>
      <span className="text-xl">{warning ? '⚠️' : '⏱'}</span>
      <div className="flex-1">
        <p className={`font-bold text-sm ${warning ? 'text-red-700' : 'text-amber-700'}`}>
          {warning ? `⚠ Time almost up — ${minsLeft} min${minsLeft !== 1 ? 's' : ''} left` : `Session ends in ${minsLeft} min${minsLeft !== 1 ? 's' : ''}`}
        </p>
        <p className="text-xs text-amber-600">You will be automatically checked out when time expires.</p>
      </div>
    </div>
  )
}

// ─── Success Screen with 5-second countdown ──────────────────────────────────
function SuccessScreen({ submittedLog, timeIn, pc, dur, expectedOut, photo, officeCloseStr, showPrivacyModal, setShowPrivacyModal, onReset }: {
  submittedLog: Record<string, unknown> | null
  timeIn: string | undefined; pc: { name: string } | null; dur: number
  expectedOut: Date | null; photo: string | null; officeCloseStr: string
  showPrivacyModal: boolean; setShowPrivacyModal: (v: boolean) => void; onReset: () => void
}) {
  const [countdown, setCountdown] = useState(10)
  const [rating, setRating]       = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const [paused, setPaused]       = useState(false)
  const [autoTimedOut, setAutoTimedOut] = useState(false)

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(t); onReset(); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [onReset, paused])

  // Pause countdown when user is interacting with rating
  const submitRating = async (r: number) => {
    setRating(r); setPaused(true)
    const logId = submittedLog?.id as string
    if (logId) {
      await fetch(`/api/logs/${logId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ satisfactionRating: r }),
      }).catch(() => {})
    }
    setRatingSubmitted(true)
    setTimeout(onReset, 2000)
  }

  const pct = (countdown / 10) * 100
  const stars = [1, 2, 3, 4, 5]
  const starLabels = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

  return (
    <div className="min-h-screen bg-[var(--bg-cream)] flex items-center justify-center p-4">
      {showPrivacyModal && <DataPrivacyModal onClose={() => setShowPrivacyModal(false)}/>}
      <div className="glass rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        {/* Photo + checkmark */}
        <div className="relative inline-block mb-4">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            {photo
              ? <img src={photo} className="w-20 h-20 rounded-full object-cover border-4 border-green-300" alt=""/>
              : <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                </svg>
            }
          </div>
          {photo && (
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center border-2 border-white">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
          )}
        </div>

        <h2 className="font-display text-2xl font-bold text-[var(--dict-blue)] mb-1">You&apos;re Logged In!</h2>
        <p className="text-gray-400 text-sm mb-5">Welcome, {submittedLog?.fullName as string}!</p>

        <div className="bg-[var(--bg-cream)] rounded-xl p-4 space-y-2.5 mb-4">
          <SRow label="Time In" value={timeIn ? format(new Date(timeIn), 'hh:mm:ss a') : '—'}/>
          {pc && <SRow label="Workstation" value={pc.name}/>}
          {expectedOut && <SRow label="Expected Out By" value={format(expectedOut, 'hh:mm a')} highlight/>}
          <SRow label="Duration" value={`${dur} hr${dur !== 1 ? 's' : ''}`}/>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700 mb-5">
          ⏰ Please finish and step out by <strong>{officeCloseStr}</strong>
        </div>

        {/* Session auto-timeout widget */}
        {!!submittedLog?.id && timeIn && (
          <div className="mb-4">
            <SessionTimer
              logId={submittedLog.id as string}
              plannedDurationHours={dur}
              timeIn={timeIn}
              officeCloseStr={officeCloseStr}
              onTimeout={() => { setAutoTimedOut(true); setTimeout(onReset, 5000) }}
            />
            {autoTimedOut && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
                <p className="text-sm font-bold text-red-700">⏰ Session Ended</p>
                <p className="text-xs text-red-500 mt-0.5">You have been automatically checked out. Thank you for using DTC!</p>
              </div>
            )}
          </div>
        )}

        {/* Satisfaction rating */}
        {!ratingSubmitted ? (
          <div className="mb-5 bg-blue-50 rounded-2xl px-4 py-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">How would you rate our service today?</p>
            <div className="flex justify-center gap-2 mb-1">
              {stars.map(s => (
                <button
                  key={s}
                  onMouseEnter={() => setHoverRating(s)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => submitRating(s)}
                  className="text-3xl transition-transform hover:scale-125 focus:outline-none"
                  aria-label={starLabels[s - 1]}
                >
                  {s <= (hoverRating || rating) ? '⭐' : '☆'}
                </button>
              ))}
            </div>
            {(hoverRating || rating) > 0 && (
              <p className="text-xs text-[var(--dict-blue)] font-semibold mt-1">
                {starLabels[(hoverRating || rating) - 1]}
                {!hoverRating && rating > 0 ? ' — tap to confirm' : ''}
              </p>
            )}
            <p className="text-[10px] text-gray-400 mt-2">Tap a star to submit · Your feedback is anonymous</p>
          </div>
        ) : (
          <div className="mb-5 bg-green-50 rounded-2xl px-4 py-4 flex items-center justify-center gap-3">
            <span className="text-2xl">🙏</span>
            <div className="text-left">
              <p className="text-sm font-bold text-green-700">Thank you for your feedback!</p>
              <p className="text-xs text-green-500">Rating: {rating}/5 stars</p>
            </div>
          </div>
        )}

        {/* Countdown bar */}
        {!paused && (
          <div className="mb-4">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-1.5 bg-[var(--dict-blue)] rounded-full transition-all duration-1000 ease-linear" style={{ width: `${pct}%` }}/>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Returning in <strong className="text-[var(--dict-blue)]">{countdown}s</strong></p>
          </div>
        )}

        <button onClick={onReset} className="w-full py-3 rounded-xl bg-[var(--dict-blue)] text-white font-bold hover:bg-blue-800 transition-colors">
          New Entry
        </button>
      </div>
    </div>
  )
}

// ─── PC Floor Grid for workstation selection ──────────────────────────────────
function PcFloorGrid({ pcs, selectedId, onSelect, now }: {
  pcs: {
    id: string; name: string; location: string | null; status: string
    icon?: string | null; gridCol?: number | null; gridRow?: number | null
    logs?: { id: string; fullName: string; timeIn: string; photoDataUrl?: string | null; plannedDurationHours?: number }[]
    ipAddress: string
  }[]
  selectedId: string; onSelect: (id: string) => void; now: Date
}) {
  // Compute grid dimensions from actual PC positions
  const maxCol = Math.max(5, ...pcs.map(p => p.gridCol ?? 1))
  const maxRow = Math.max(1, ...pcs.map(p => p.gridRow ?? 1))

  return (
    <div>
      {/* Legend */}
      <div className="flex gap-3 flex-wrap mb-3 text-xs">
        {[
          { color: 'bg-green-400', label: 'Available — click to select' },
          { color: 'bg-orange-400', label: 'In Use' },
          { color: 'bg-gray-300', label: 'Offline — can still select' },
          { color: 'bg-yellow-400', label: 'Maintenance' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${l.color}`}/>
            <span className="text-gray-500">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div
        className="border border-gray-100 rounded-2xl overflow-hidden bg-gray-50 p-2"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${maxCol}, minmax(0, 1fr))`, gap: '6px' }}>
        {Array.from({ length: maxRow }, (_, row) =>
          Array.from({ length: maxCol }, (_, col) => {
            const r = row + 1, c = col + 1
            const pc = pcs.find(p => (p.gridRow ?? 1) === r && (p.gridCol ?? 1) === c)
            const isSelectable = pc && pc.status !== 'IN_USE' && pc.status !== 'MAINTENANCE'
            const isSel = pc && selectedId === pc.id

            if (!pc) {
              // Empty space cell
              return (
                <div key={`${r}-${c}`}
                  className="rounded-xl border border-dashed border-gray-200 min-h-[90px] bg-white/50"/>
              )
            }

            const currentUser = pc.logs?.[0]
            const initials = currentUser
              ? currentUser.fullName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
              : ''

            // Compute if current user is overdue
            let userStatus: 'ok' | 'soon' | 'overdue' | null = null
            if (currentUser && pc.status === 'IN_USE') {
              const dur = currentUser.plannedDurationHours ?? 1
              const expectedOut = new Date(new Date(currentUser.timeIn).getTime() + dur * 3600000)
              const minsLeft = Math.floor((expectedOut.getTime() - now.getTime()) / 60000)
              if (minsLeft < 0) userStatus = 'overdue'
              else if (minsLeft <= 15) userStatus = 'soon'
              else userStatus = 'ok'
            }

            return (
              <div key={`${r}-${c}`}
                onClick={() => isSelectable && onSelect(isSel ? '' : pc.id)}
                className={`rounded-xl border-2 p-2.5 transition-all select-none ${
                  isSel
                    ? 'border-[var(--dict-blue)] bg-blue-50 ring-2 ring-blue-200 cursor-pointer'
                    : pc.status === 'IN_USE'
                    ? 'border-orange-300 bg-orange-50 cursor-not-allowed'
                    : pc.status === 'MAINTENANCE'
                    ? 'border-yellow-300 bg-yellow-50 opacity-50 cursor-not-allowed'
                    : pc.status === 'ONLINE'
                    ? 'border-green-300 bg-green-50 hover:border-green-500 hover:scale-[1.02] cursor-pointer'
                    : 'border-gray-200 bg-gray-50 hover:border-blue-200 hover:scale-[1.02] cursor-pointer'
                }`}>

                {/* Top row: icon + status dot */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-lg leading-none">{pc.icon || '🖥️'}</span>
                  <div className="flex items-center gap-1">
                    {isSel && <span className="text-[10px] bg-[var(--dict-blue)] text-white px-1.5 py-0.5 rounded-full font-bold">✓</span>}
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      pc.status === 'ONLINE' ? 'bg-green-500 animate-pulse'
                      : pc.status === 'IN_USE' ? (userStatus === 'overdue' ? 'bg-red-500' : 'bg-orange-500')
                      : pc.status === 'MAINTENANCE' ? 'bg-yellow-400'
                      : 'bg-gray-300'
                    }`}/>
                  </div>
                </div>

                <p className="font-display font-bold text-gray-800 text-xs leading-tight">{pc.name}</p>
                {pc.location && <p className="text-gray-400 text-[10px] truncate">{pc.location}</p>}

                <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  pc.status === 'ONLINE' ? 'bg-green-100 text-green-700'
                  : pc.status === 'IN_USE' ? (userStatus === 'overdue' ? 'bg-red-100 text-red-600' : userStatus === 'soon' ? 'bg-amber-100 text-amber-600' : 'bg-orange-100 text-orange-700')
                  : pc.status === 'MAINTENANCE' ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-500'
                }`}>
                  {pc.status === 'IN_USE'
                    ? (userStatus === 'overdue' ? '⚠ Overdue' : userStatus === 'soon' ? '⏰ Almost done' : 'In Use')
                    : pc.status === 'ONLINE' ? 'Available'
                    : pc.status === 'MAINTENANCE' ? 'Maintenance'
                    : 'Offline'}
                </span>

                {/* In-use person */}
                {pc.status === 'IN_USE' && currentUser && (
                  <div className="mt-2 pt-1.5 border-t border-orange-200 flex items-center gap-1.5">
                    {currentUser.photoDataUrl
                      ? <img src={currentUser.photoDataUrl} className="w-7 h-7 rounded-full object-cover border border-orange-200 flex-shrink-0" alt=""/>
                      : <div className="w-7 h-7 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 font-bold text-[10px] flex-shrink-0">{initials}</div>
                    }
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-orange-800 truncate leading-tight">{currentUser.fullName.split(' ')[0]}</p>
                      {(() => {
                        const dur = currentUser.plannedDurationHours ?? 1
                        const expectedOut = new Date(new Date(currentUser.timeIn).getTime() + dur * 3600000)
                        const minsLeft = Math.floor((expectedOut.getTime() - now.getTime()) / 60000)
                        if (minsLeft < 0) return <p className="text-[9px] text-red-500 font-semibold">⚠ {Math.abs(minsLeft)}m overdue</p>
                        return <p className="text-[9px] text-orange-400">out ~{format(expectedOut, 'hh:mm a')}</p>
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function LogbookPage() {
  const [now, setNow] = useState(new Date())
  const [settings, setSettings] = useState<Settings | null>(null)
  const [accessGranted, setAccessGranted] = useState(false)
  const [accessInput, setAccessInput] = useState('')
  const [accessError, setAccessError] = useState('')
  const [step, setStep] = useState<'form' | 'pc-select' | 'internet-info' | 'success'>('form')
  const [pcs, setPcs] = useState<PC[]>([])
  const [pinging, setPinging] = useState(false)
  const [pingingId, setPingingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submittedLog, setSubmittedLog] = useState<Record<string, unknown> | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [usageDuration, setUsageDuration] = useState('1')
  const [customDuration, setCustomDuration] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [purposeFocus, setPurposeFocus] = useState(false)
  const [showPCCountModal, setShowPCCountModal] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [form, setForm] = useState({ fullName: '', agency: '', purpose: '', equipmentUsed: [] as string[], pcId: '' })
  const [pcTerms, setPcTerms] = useState(PC_TERMS.map(() => false))
  const [wifiTerms, setWifiTerms] = useState(WIFI_TERMS.map(() => false))
  const [photo, setPhoto] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [consentChecked, setConsentChecked] = useState(false)
  const [showConsentModal, setShowConsentModal] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Voice command handler
  const handleVoiceCommand = (cmd: { action: string; field?: string; value?: string; message?: string }) => {
    if (cmd.action === 'show_pc_count') {
      setShowPCCountModal(true)
    } else if (cmd.action === 'fill_field' && cmd.field && cmd.value) {
      if (cmd.field === 'fullName') {
        setForm(f => ({ ...f, fullName: sanitizeName(cmd.value || '') }))
      } else if (cmd.field === 'agency') {
        setForm(f => ({ ...f, agency: sanitizeAgency(cmd.value || '') }))
      } else if (cmd.field === 'purpose') {
        setForm(f => ({ ...f, purpose: cmd.value || '' }))
      }
    }
  }

  // Fetch settings + PCs on mount and sync offline data
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try { const c = localStorage.getItem(STORAGE_KEY_SETTINGS); if (c) setSettings(JSON.parse(c)) } catch {}
    }
    fetch('/api/settings').then(r => r.json()).then((s: Settings) => {
      setSettings(s)
      try { localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(s)) } catch {}
    }).catch(() => setSettings({ wifiSsid: 'DICT-DTC-Free', wifiPassword: '', wifiNote: 'Free public WiFi', accessCode: '1234', officeOpen: '08:00', officeClose: '17:00', bgImageUrl: '', interactiveBannerUrl: '' }))
    
    fetchPCs()
    fetchAnnouncements()
    syncOfflineData().then(result => {
      if (result.synced > 0) {
        console.log(`Synced ${result.synced} offline entries`)
      }
    }).catch(err => console.error('Offline sync failed:', err))
    
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // ── Apply dynamic background from settings ──────────────────────────────────
  useEffect(() => {
    let styleEl = document.getElementById('dtc-dynamic-bg') as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'dtc-dynamic-bg'
      document.head.appendChild(styleEl)
    }
    if (settings?.bgImageUrl) {
      styleEl.textContent = `:root { --bg-image: url('${settings.bgImageUrl.replace(/'/g, "\\'")}') }`
    } else {
      // Reset to default — globals.css var(--bg-image) picks up /Bg.png
      styleEl.textContent = `:root { --bg-image: url('/Bg.png') }`
    }
  }, [settings?.bgImageUrl])

  // ── Announcements ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/announcements')
      .then(r => r.json())
      .then(d => Array.isArray(d) ? setAnnouncements(d) : [])
      .catch(() => {})
  }, [])

  // ── Access code ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(STORAGE_KEY_AUTH) === 'true') setAccessGranted(true)
  }, [])

  const submitAccess = () => {
    if (!settings) return
    if (accessInput.trim() === settings.accessCode) {
      sessionStorage.setItem(STORAGE_KEY_AUTH, 'true'); setAccessGranted(true); setAccessError('')
    } else {
      setAccessError('Incorrect code. Ask the staff for today\'s access code.'); setAccessInput('')
    }
  }

  // ── PCs ─────────────────────────────────────────────────────────────────────
  const fetchPCs = useCallback(async () => {
    try { const r = await fetch('/api/pcs'); if (r.ok) setPcs(await r.json()) } catch {}
  }, [])

  // ── Announcements ────────────────────────────────────────────────────────────
  const fetchAnnouncements = useCallback(async () => {
    try {
      const r = await fetch('/api/announcements')
      if (r.ok) {
        const data = await r.json()
        setAnnouncements(Array.isArray(data) ? data : [])
      }
    } catch {}
  }, [])

  // ── Camera ──────────────────────────────────────────────────────────────────
  useEffect(() => () => stopCamera(), [])
  const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
    if (node) {
      videoRef.current = node
      if (streamRef.current) { node.srcObject = streamRef.current; node.play().catch(() => {}) }
    }
  }, [])
  const startCamera = async () => {
    setCameraError(null); stopCamera()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      streamRef.current = stream; setCameraActive(true)
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}) } }, 80)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setCameraError(msg.includes('Permission') || msg.includes('NotAllowed') ? 'Camera permission denied. Allow in browser settings.' : msg.includes('NotFound') ? 'No camera found.' : 'Camera error: ' + msg)
      setCameraActive(false)
    }
  }
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null; setCameraActive(false)
  }
  const capturePhoto = () => {
    const v = videoRef.current, c = canvasRef.current; if (!v || !c) return
    c.width = v.videoWidth || 320; c.height = v.videoHeight || 240
    c.getContext('2d')?.drawImage(v, 0, 0); setPhoto(c.toDataURL('image/jpeg', 0.75)); stopCamera()
  }

  // ── Derived state ────────────────────────────────────────────────────────────
  const hasPC = form.equipmentUsed.includes('Desktop Computer')
  const hasWifi = form.equipmentUsed.includes('Internet Only')
  const hasBoth = hasPC && hasWifi
  const pcTermsOk = !hasPC || pcTerms.every(Boolean)
  const wifiTermsOk = !hasWifi || wifiTerms.every(Boolean)
  const officeState = settings ? getOfficeState(now, settings.officeOpen, settings.officeClose) : 'open'
  const officeCloseStr = settings ? closingAt(settings.officeClose) : '5:00 PM'
  const maxDuration = settings ? getMaxDurationHours(now, settings.officeClose) : 8
  const effectiveDuration = showCustom ? Math.min(parseFloat(customDuration) || 1, maxDuration) : Math.min(parseFloat(usageDuration) || 1, maxDuration)
  
  // Service type determination - all client self-service entries use SELF_SERVICE
  // STAFF_ASSISTED is only set by admin panel when staff helps the client
  const serviceType = 'SELF_SERVICE'
  
  // Display name for equipment - when both selected, show 'Internet' instead of 'Internet Only'
  const equipmentDisplayName = hasBoth ? 'Internet' : hasWifi ? 'Internet' : hasPC ? 'Desktop Computer' : ''

  // Purpose autocomplete filter
  const purposeSuggestions = useMemo(() => {
    if (!form.purpose || form.purpose.length < 2) return PURPOSE_SUGGESTIONS
    return PURPOSE_SUGGESTIONS.filter(s => s.toLowerCase().includes(form.purpose.toLowerCase()))
  }, [form.purpose])

  // ── Toggle equipment — allow both ────────────────────────────────────────────
  const toggleEquipment = (item: string) => {
    setForm(f => ({
      ...f,
      equipmentUsed: f.equipmentUsed.includes(item)
        ? f.equipmentUsed.filter(e => e !== item)
        : [...f.equipmentUsed, item]
    }))
    // Reset terms when toggling off
    if (item === 'Desktop Computer' && form.equipmentUsed.includes(item)) setPcTerms(PC_TERMS.map(() => false))
    if (item === 'Internet Only' && form.equipmentUsed.includes(item)) setWifiTerms(WIFI_TERMS.map(() => false))
  }

  // ── Validation ───────────────────────────────────────────────────────────────
  const validateForm = () => {
    const e: Record<string, string> = {}
    if (!form.fullName.trim()) e.fullName = 'Full name is required'
    else if (form.fullName.trim().split(/\s+/).length < 2) e.fullName = 'Please enter your complete first and last name'
    if (!form.agency.trim()) e.agency = 'Agency / organization is required'
    if (!form.purpose.trim() || form.purpose.trim().length < 5) e.purpose = 'Describe your purpose (minimum 5 characters)'
    if (form.equipmentUsed.length === 0) e.equipment = 'Please select at least one service'
    if (!pcTermsOk) e.terms = 'Please agree to all computer use terms'
    if (!wifiTermsOk) e.terms = 'Please agree to all WiFi use terms'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Next routing ─────────────────────────────────────────────────────────────
  const handleNext = () => {
    if (!validateForm()) return
    if (hasPC) {
      pingAllPcs()
      setStep('pc-select')
    } else if (hasWifi) {
      setStep('internet-info')
    }
  }

  // After PC selection, if both, show wifi next; else submit
  const handlePcNext = () => {
    if (hasBoth) { setStep('internet-info') }
    else { handleSubmit() }
  }

  const pingAllPcs = async () => {
    setPinging(true)
    try {
      await fetch('/api/network/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pingAll: true }) })
      await fetchPCs()
    } catch {}
    setPinging(false)
  }
  const pingOnePc = async (pc: PC) => {
    setPingingId(pc.id)
    try { await fetch(`/api/network/ping?ip=${pc.ipAddress}`); await fetchPCs() } catch {}
    setPingingId(null)
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async (selectedPcId?: string) => {
    setSubmitting(true)
    try {
      // Ensure pcId is null if empty string or undefined
      const finalPcId = selectedPcId || form.pcId || null
      const cleanPcId = finalPcId === '' ? null : finalPcId
      
      const payload = {
        fullName: form.fullName.trim(),
        agency: form.agency.trim(),
        purpose: form.purpose.trim(),
        equipmentUsed: form.equipmentUsed,
        pcId: cleanPcId,
        photoDataUrl: photo || null,
        plannedDurationHours: effectiveDuration,
        serviceType
      }
      
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      
      if (!res.ok) {
        // Show detailed validation errors if available
        if (data.details) {
          const errorMsg = Object.entries(data.details.fieldErrors || {})
            .map(([field, errors]) => `${field}: ${(errors as string[]).join(', ')}`)
            .join('\n') || data.error
          throw new Error(errorMsg)
        }
        throw new Error(data.error || 'Submission failed')
      }
      
      setSubmittedLog(data); stopCamera(); setStep('success')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      alert(`Submission Error:\n\n${errorMessage}\n\nPlease check your entries and try again.`)
      setStep('form')
    } finally { setSubmitting(false) }
  }

  const resetForm = () => {
    setForm({ fullName: '', agency: '', purpose: '', equipmentUsed: [], pcId: '' })
    setErrors({}); setSubmittedLog(null); setPhoto(null)
    setUsageDuration('1'); setCustomDuration(''); setShowCustom(false)
    setPcTerms(PC_TERMS.map(() => false)); setWifiTerms(WIFI_TERMS.map(() => false))
    setConsentChecked(false); stopCamera(); setStep('form'); fetchPCs()
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ACCESS GATE (blurred overlay on everything)
  // ════════════════════════════════════════════════════════════════════════════
  const AccessGate = settings && !accessGranted && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', backgroundColor: 'rgba(0,15,60,0.65)' }}>
      <div className="glass rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-full bg-blue-50 border-2 border-blue-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[var(--dict-blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>
        <h2 className="font-display font-bold text-xl text-gray-800 mb-1">Verification Required</h2>
        <p className="text-sm text-gray-400 mb-6">Enter the access code provided by the DTC staff to continue.</p>
        <div className="space-y-3">
          <input type="password" value={accessInput} onChange={e => setAccessInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitAccess()}
            placeholder="• • • • • •" maxLength={10}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-[0.4em] outline-none focus:border-[var(--dict-blue)] transition-colors"/>
          {accessError && <p className="text-red-500 text-xs bg-red-50 rounded-xl py-2 px-3">{accessError}</p>}
          <button onClick={submitAccess} className="w-full py-3 bg-[var(--dict-blue)] text-white rounded-xl font-bold hover:bg-blue-800 transition-colors">Continue</button>
        </div>
        <p className="text-xs text-gray-300 mt-5">DICT Region V · Digital Transformation Center</p>
      </div>
    </div>
  )

  // ════════════════════════════════════════════════════════════════════════════
  // OFFICE CLOSED
  // ════════════════════════════════════════════════════════════════════════════
  if (settings && officeState === 'closed' && accessGranted) {
    const openTime = closingAt(settings.officeOpen)
    const isBeforeOpen = now.getHours() < parseTime(settings.officeOpen).h
    return (
      <div className="min-h-screen bg-[var(--dict-blue)] flex flex-col items-center justify-center p-4 text-white text-center relative">
        {AccessGate}
        <div className="text-6xl mb-6 animate-bounce">{isBeforeOpen ? '🌅' : '🌙'}</div>
        <h1 className="font-display text-3xl font-bold mb-2">Office Closed</h1>
        <p className="text-blue-200 mb-1">{format(now, 'EEEE, MMMM d, yyyy')}</p>
        <p className="font-mono text-4xl font-bold mb-6">{format(now, 'hh:mm:ss a')}</p>
        <div className="bg-white/10 backdrop-blur rounded-2xl px-8 py-5 mb-4">
          <p className="text-blue-200 text-sm mb-1">Office Hours</p>
          <p className="font-bold text-xl">{openTime} – {officeCloseStr}</p>
          <p className="text-blue-200 text-sm mt-1">Monday – Friday</p>
        </div>
        {isBeforeOpen && (
          <p className="text-blue-300 text-sm">Opens in {Math.max(0, Math.floor((timeToDate(settings.officeOpen, now).getTime() - now.getTime()) / 60000))} minutes</p>
        )}
        {/* Contact footer */}
        <div className="absolute bottom-6 left-0 right-0 text-center">
          <p className="text-blue-300 text-xs">📍 DICT Region V · Legazpi City, Albay · 📞 (052) 742-5670</p>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SUCCESS
  // ════════════════════════════════════════════════════════════════════════════
  // ── 5-second countdown on success ──
  if (step === 'success') {
    const timeIn = submittedLog?.timeIn as string | undefined
    const pc = submittedLog?.pc as { name: string } | null
    const dur = (submittedLog?.plannedDurationHours as number) || 1
    const expectedOut = timeIn ? new Date(new Date(timeIn).getTime() + dur * 3600000) : null
    return (
      <SuccessScreen
        submittedLog={submittedLog}
        timeIn={timeIn}
        pc={pc}
        dur={dur}
        expectedOut={expectedOut}
        photo={photo}
        officeCloseStr={officeCloseStr}
        showPrivacyModal={showPrivacyModal}
        setShowPrivacyModal={setShowPrivacyModal}
        onReset={resetForm}
      />
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PC SELECTION STEP
  // ════════════════════════════════════════════════════════════════════════════
  if (step === 'pc-select') {
    const expectedOut = addHours(now, effectiveDuration)
    return (
      <div className="min-h-screen p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {officeState === 'closing_soon' && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl px-5 py-3 flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-bold text-amber-800 text-sm">Closing at {officeCloseStr}!</p>
                <p className="text-amber-600 text-xs">Max duration adjusted.</p>
              </div>
            </div>
          )}

          {/* Progress indicator */}
          {hasBoth && (
            <div className="glass rounded-2xl px-5 py-3 shadow-sm flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="w-7 h-7 rounded-full bg-[var(--dict-blue)] text-white flex items-center justify-center text-xs font-bold">1</div>
                <span className="text-sm font-semibold text-[var(--dict-blue)]">Choose PC</span>
              </div>
              <div className="h-px flex-1 bg-gray-200"/>
              <div className="flex items-center gap-2 flex-1 opacity-40">
                <div className="w-7 h-7 rounded-full bg-gray-300 text-white flex items-center justify-center text-xs font-bold">2</div>
                <span className="text-sm font-semibold text-gray-400">WiFi Info</span>
              </div>
            </div>
          )}

          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display text-xl font-bold text-[var(--dict-blue)]">Choose a Workstation</h2>
              <button onClick={pingAllPcs} disabled={pinging}
                className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl border border-blue-200 text-[var(--dict-blue)] hover:bg-blue-50 disabled:opacity-50">
                {pinging ? <><Spinner/> Pinging...</> : <>🔄 Refresh</>}
              </button>
            </div>
            {pcs.length === 0
              ? <p className="text-center text-gray-300 py-8 text-sm">No workstations configured yet.</p>
              : <PcFloorGrid
                  pcs={pcs}
                  selectedId={form.pcId}
                  onSelect={id => setForm(f => ({ ...f, pcId: id }))}
                  now={now}
                />
            }
          </div>

          {/* Duration */}
          <div className="glass rounded-2xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 text-sm mb-1">How long will you use it?</h3>
            <p className="text-xs text-gray-400 mb-3">Office closes at <strong>{officeCloseStr}</strong> — max {maxDuration < 1 ? Math.round(maxDuration * 60) + 'min' : maxDuration + 'hr'} remaining</p>
            <DurationPicker now={now} maxDuration={maxDuration} officeCloseStr={officeCloseStr} usageDuration={usageDuration} setUsageDuration={setUsageDuration} customDuration={customDuration} setCustomDuration={setCustomDuration} showCustom={showCustom} setShowCustom={setShowCustom}/>
            <div className="mt-3 bg-blue-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Expected checkout:</span>
              <span className="font-bold text-[var(--dict-blue)]">{format(expectedOut, 'hh:mm a')}</span>
            </div>
            {/* Over-time warning */}
            {(() => {
              const closeToday = new Date()
              const [closeParts] = officeCloseStr.split(':')
              const closeH = parseInt(closeParts)
              const closeM = parseInt(officeCloseStr.split(':')[1] || '0')
              const isPm = officeCloseStr.toLowerCase().includes('pm')
              closeToday.setHours((isPm && closeH !== 12) ? closeH + 12 : closeH, closeM, 0, 0)
              if (expectedOut > closeToday) return (
                <div className="mt-2 bg-red-50 border-2 border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
                  <span className="text-red-500 flex-shrink-0">⚠️</span>
                  <div>
                    <p className="text-xs font-bold text-red-600">Duration exceeds closing time!</p>
                    <p className="text-xs text-red-500 mt-0.5">We apologize, but we can only accommodate you until <strong>{officeCloseStr}</strong>. Please select a shorter duration.</p>
                  </div>
                </div>
              )
              return null
            })()}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('form')} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50">← Back</button>
            <button onClick={handlePcNext} disabled={submitting}
              className="flex-[2] py-3 rounded-xl bg-[var(--dict-blue)] text-white font-bold hover:bg-blue-800 disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting ? <><Spinner/> Submitting...</> : hasBoth ? 'Next: WiFi Info →' : form.pcId ? `Confirm ${form.pcId ? '— ' + (pcs.find(p=>p.id===form.pcId)?.name||'') : ''} & Submit` : 'Submit Without Workstation'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // INTERNET INFO / WIFI STEP
  // ════════════════════════════════════════════════════════════════════════════
  if ((step === 'internet-info') && settings) {
    const expectedOut = addHours(now, effectiveDuration)
    return (
      <div className="min-h-screen p-4 sm:p-6">
        <div className="max-w-lg mx-auto space-y-4">
          {/* Progress if both */}
          {hasBoth && (
            <div className="glass rounded-2xl px-5 py-3 shadow-sm flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 opacity-50">
                <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">✓</div>
                <span className="text-sm font-semibold text-gray-400">PC Selected</span>
              </div>
              <div className="h-px flex-1 bg-gray-200"/>
              <div className="flex items-center gap-2 flex-1">
                <div className="w-7 h-7 rounded-full bg-[var(--dict-blue)] text-white flex items-center justify-center text-xs font-bold">2</div>
                <span className="text-sm font-semibold text-[var(--dict-blue)]">WiFi Info</span>
              </div>
            </div>
          )}

          <div className="bg-[var(--dict-blue)] text-white rounded-2xl p-6 text-center">
            <div className="text-4xl mb-2">📶</div>
            <h2 className="font-display text-2xl font-bold mb-1">Free WiFi</h2>
            <p className="text-blue-200 text-sm">{settings.wifiNote}</p>
          </div>

          <div className="glass rounded-2xl shadow-sm p-6 flex flex-col items-center gap-4">
            <img src={wifiQrUrl(settings.wifiSsid, settings.wifiPassword)} alt="WiFi QR" className="w-44 h-44 rounded-xl border-4 border-gray-100"/>
            <p className="text-xs text-gray-400">Scan with your phone camera to connect instantly</p>
            <div className="w-full bg-[var(--bg-cream)] rounded-xl px-5 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-semibold">Network (SSID)</span>
                <span className="font-mono font-bold text-gray-800 text-sm">{settings.wifiSsid}</span>
              </div>
              {settings.wifiPassword ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-semibold">Password</span>
                  <span className="font-mono font-bold text-gray-800 text-sm">{settings.wifiPassword}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400"/>
                  <span className="text-xs text-green-600 font-semibold">Open network — no password needed</span>
                </div>
              )}
            </div>
          </div>

          {/* Duration (only show if not both — if both, duration was set at PC step) */}
          {!hasBoth && (
            <div className="glass rounded-2xl shadow-sm p-5">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">How long will you use the WiFi?</h3>
              <p className="text-xs text-gray-400 mb-3">Must finish before {officeCloseStr}</p>
              <DurationPicker now={now} maxDuration={maxDuration} officeCloseStr={officeCloseStr} usageDuration={usageDuration} setUsageDuration={setUsageDuration} customDuration={customDuration} setCustomDuration={setCustomDuration} showCustom={showCustom} setShowCustom={setShowCustom}/>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 text-center">
            <p className="text-xs text-blue-400 mb-1">Expected departure</p>
            <p className="font-display font-bold text-2xl text-[var(--dict-blue)]">{format(expectedOut, 'hh:mm a')}</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => hasBoth ? setStep('pc-select') : setStep('form')} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50">← Back</button>
            <button onClick={() => handleSubmit(form.pcId || undefined)} disabled={submitting}
              className="flex-[2] py-3 rounded-xl bg-[var(--dict-blue)] text-white font-bold hover:bg-blue-800 disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting ? <><Spinner/> Submitting...</> : 'Confirm & Submit ✓'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MAIN FORM
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen" style={{position:"relative",zIndex:1}}>
      {AccessGate}
      {showPrivacyModal && <DataPrivacyModal onClose={() => setShowPrivacyModal(false)}/>}

      {/* Announcements banner */}
      {announcements.length > 0 && accessGranted && (
        <div className="space-y-0">
          {announcements.map(ann => (
            <div key={ann.id} className={`px-4 py-3 text-sm flex items-start gap-3 ${
              ann.type === 'WARNING' || ann.type === 'MAINTENANCE'
                ? 'bg-amber-500 text-white'
                : ann.type === 'HOLIDAY'
                ? 'bg-red-600 text-white'
                : 'bg-[var(--dict-blue)] text-white'
            }`}>
              <span className="flex-shrink-0 mt-0.5">
                {ann.type === 'WARNING' ? '⚠️' : ann.type === 'MAINTENANCE' ? '🔧' : ann.type === 'HOLIDAY' ? '🎉' : 'ℹ️'}
              </span>
              <div>
                <span className="font-bold">{ann.title}</span>
                {ann.body && <span className="ml-1 opacity-90"> — {ann.body}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl shadow-2xl p-7 max-w-sm w-full">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[var(--dict-blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <h3 className="font-display font-bold text-lg text-center mb-2">Photo Consent</h3>
            <p className="text-sm text-gray-500 text-center mb-4">Your photo will be stored for identification per <button onClick={() => { setShowConsentModal(false); setShowPrivacyModal(true) }} className="text-[var(--dict-blue)] underline font-medium">RA 10173</button>.</p>
            <label className="flex items-start gap-3 mb-5 cursor-pointer" onClick={() => setConsentChecked(v => !v)}>
              <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${consentChecked ? 'bg-[var(--dict-blue)] border-[var(--dict-blue)]' : 'border-gray-300'}`}>
                {consentChecked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
              </div>
              <span className="text-sm text-gray-600">I consent to having my photo captured and stored with my logbook entry.</span>
            </label>
            <div className="flex gap-3">
              <button onClick={() => { setShowConsentModal(false); setConsentChecked(false) }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm">Decline</button>
              <button onClick={() => { if (!consentChecked) return; setShowConsentModal(false); startCamera() }} disabled={!consentChecked}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${consentChecked ? 'bg-[var(--dict-blue)] text-white hover:bg-blue-800' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                I Consent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Government Header ── */}
      <header className="bg-[var(--dict-blue)] sticky top-0 z-10 shadow-lg">
        {/* Top accent bar — Philippine flag colors */}
        <div className="flex h-1.5">
          <div className="flex-1 bg-[#0038A8]"/>
          <div className="flex-1 bg-[#CE1126]"/>
          <div className="flex-1 bg-[#FCD116]"/>
        </div>

        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 py-3">

            {/* LEFT — DICT Seal + Title */}
            <div className="flex items-center gap-3 min-w-0">
              <GovSeal size="lg"/>
              <div className="min-w-0">
                <div className="font-display font-bold text-white text-sm sm:text-base leading-tight truncate">
                  Digital Transformation Center
                </div>
                <div className="text-blue-200 text-xs leading-tight">
                  DICT Regional Office V · Bicol Region
                </div>
              </div>
            </div>

            {/* CENTER — Date/Time + closing warning */}
            <div className="hidden sm:flex flex-col items-center flex-shrink-0">
              <div className="font-mono text-white font-bold text-xl leading-none tracking-wide">
                {format(now, 'hh:mm:ss a')}
              </div>
              <div className="text-blue-200 text-xs mt-0.5">{format(now, 'EEEE, MMMM d, yyyy')}</div>
              {officeState === 'closing_soon' && (
                <div className="mt-1 bg-[var(--dict-gold)] text-[var(--dict-blue)] text-xs font-bold px-3 py-0.5 rounded-full animate-pulse">
                  ⏰ Closes {officeCloseStr}
                </div>
              )}
            </div>

            {/* RIGHT — ILCDB + Bagong Pilipinas logos */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <GovHeaderLogos/>

              {/* Mobile: just show time */}
              <div className="flex sm:hidden flex-col items-end">
                <div className="font-mono text-white font-bold text-sm">{format(now, 'hh:mm a')}</div>
                <div className="text-blue-200 text-[10px]">{format(now, 'MMM d')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom blue bar with DTC subtitle */}
        <div className="bg-white/10 border-t border-white/10">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between">
            <p className="text-blue-100 text-xs font-medium tracking-wide uppercase">
              Client Logbook System · Free ICT Services
            </p>
            <p className="text-blue-200/70 text-[10px] hidden sm:block">
              Serving Camarines Sur · Camarines Norte · Catanduanes · Masbate · Sorsogon · Albay
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Two-column layout: form left, info panel right ── */}
        <div className="flex gap-6 items-start">

          {/* ── LEFT COLUMN: logbook form ── */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Hero */}
            <div className="bg-[var(--dict-blue)] text-white rounded-2xl p-5 flex items-center justify-between">
              <div>
                <h1 className="font-display text-xl font-bold">Client Logbook</h1>
                <p className="text-blue-200 text-sm mt-0.5">Free Use of ICT Equipment and Internet Services</p>
              </div>
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-blue-200 text-xs">Walk-in Service</span>
                <span className="text-white font-semibold text-sm">No Appointment Needed</span>
              </div>
            </div>

        {officeState === 'closing_soon' && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl px-5 py-3 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <p className="text-amber-800 text-sm font-semibold">Office closes at {officeCloseStr}. Duration is limited accordingly.</p>
          </div>
        )}

        {/* Photo */}
        <div className="glass rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <div><h3 className="font-semibold text-gray-700 text-sm">Client Photo</h3><p className="text-xs text-gray-400">Optional — for identification</p></div>
            {!photo && !cameraActive && (
              <button onClick={() => setShowConsentModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-[var(--dict-blue)] text-sm font-medium border border-blue-100 hover:bg-blue-100 transition-colors">📷 Take Photo</button>
            )}
          </div>
          {cameraError && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-3">{cameraError}</div>}
          {cameraActive && !photo && (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-black w-full" style={{ aspectRatio: '4/3', maxHeight: '260px' }}>
                <video ref={videoCallbackRef} autoPlay muted playsInline className="w-full h-full object-cover"/>
                <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">📷 Live Preview</div>
              </div>
              <div className="flex gap-2">
                <button onClick={capturePhoto} className="flex-1 py-3 bg-[var(--dict-blue)] text-white rounded-xl text-sm font-bold hover:bg-blue-800">📷 Capture</button>
                <button onClick={stopCamera} className="px-4 py-3 border border-gray-200 text-gray-500 rounded-xl text-sm">Cancel</button>
              </div>
            </div>
          )}
          {photo && (
            <div className="flex items-center gap-4">
              <img src={photo} className="w-20 h-20 rounded-xl object-cover border-2 border-green-200" alt=""/>
              <div>
                <p className="text-sm text-green-600 font-semibold">✓ Photo captured</p>
                <p className="text-xs text-gray-400">Stored securely with your entry</p>
                <button onClick={() => { setPhoto(null); startCamera() }} className="mt-1.5 text-xs text-blue-500 underline">Retake</button>
              </div>
            </div>
          )}
          {!cameraActive && !photo && !cameraError && <p className="text-xs text-gray-300 italic">Click &ldquo;Take Photo&rdquo; above. Consent required.</p>}
          <canvas ref={canvasRef} className="hidden"/>
        </div>

        {/* Form fields */}
        <div className="glass rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">

          {/* Full Name */}
          <Field label="Full Name" required error={errors.fullName}>
            <input type="text" value={form.fullName}
              onChange={e => setForm(f => ({ ...f, fullName: sanitizeName(e.target.value) }))}
              placeholder="e.g. Juan A. dela Cruz"
              maxLength={80}
              className={iCls(!!errors.fullName)}/>
            <p className="text-xs text-gray-300 mt-1">Letters only. Include first name, middle initial, and last name.</p>
          </Field>

          {/* Agency */}
          <Field label="Agency / Organization / School" required error={errors.agency}>
            <input type="text" value={form.agency}
              onChange={e => setForm(f => ({ ...f, agency: sanitizeAgency(e.target.value) }))}
              placeholder="e.g. LGU Donsol, DepEd Sorsogon, Private Individual"
              maxLength={100}
              className={iCls(!!errors.agency)}/>
            <p className="text-xs text-gray-300 mt-1">Letters and numbers allowed.</p>
          </Field>

          {/* Purpose with autocomplete */}
          <Field label="Purpose / Service Availed" required error={errors.purpose}>
            <div className="relative">
              <textarea
                value={form.purpose}
                onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                onFocus={() => setPurposeFocus(true)}
                onBlur={() => setTimeout(() => setPurposeFocus(false), 150)}
                rows={2}
                placeholder="Type or select your purpose below..."
                className={iCls(!!errors.purpose) + ' resize-none'}
              />
              {/* Suggestions dropdown */}
              {purposeFocus && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-20 max-h-48 overflow-y-auto">
                  {purposeSuggestions.map(s => (
                    <button key={s} type="button"
                      onMouseDown={() => { setForm(f => ({ ...f, purpose: s })); setPurposeFocus(false) }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 hover:text-[var(--dict-blue)] transition-colors border-b border-gray-50 last:border-0 ${form.purpose === s ? 'bg-blue-50 text-[var(--dict-blue)] font-medium' : 'text-gray-600'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-300 mt-1">Click the field to see common purposes, or type your own.</p>
          </Field>

          {/* Equipment Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              ICT Equipment / Service <span className="text-[var(--dict-red)]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'Desktop Computer', icon: '🖥️', desc: 'Use a PC workstation', display: 'Desktop Computer' },
                { key: 'Internet Only', icon: '📶', desc: 'Connect your own device', display: 'Internet' },
              ].map(({ key, icon, desc, display }) => {
                const sel = form.equipmentUsed.includes(key)
                return (
                  <button key={key} type="button" onClick={() => toggleEquipment(key)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${sel ? 'border-[var(--dict-blue)] bg-blue-50' : 'border-gray-200 hover:border-blue-200 bg-white'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-3xl">{icon}</span>
                      <span className="font-bold text-gray-800 text-base">{display}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                  </button>
                )
              })}
            </div>
            {errors.equipment && <p className="text-red-500 text-xs mt-2 flex items-center gap-1">⚠ {errors.equipment}</p>}
          </div>

          {/* Terms — shown only when equipment is selected */}
          {(hasPC || hasWifi) && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="flex-1 h-px bg-gray-100"/>
                <span className="font-semibold uppercase tracking-wide">Terms of Use</span>
                <div className="flex-1 h-px bg-gray-100"/>
              </div>

              {hasPC && (
                <TermsBlock
                  title="Computer / Workstation Use Agreement"
                  icon="🖥️" color="text-blue-700"
                  terms={PC_TERMS}
                  checked={pcTerms}
                  onChange={(i, v) => setPcTerms(prev => { const n = [...prev]; n[i] = v; return n })}
                />
              )}
              {hasWifi && (
                <TermsBlock
                  title="Internet / WiFi Use Agreement"
                  icon="📶" color="text-green-700"
                  terms={WIFI_TERMS}
                  checked={wifiTerms}
                  onChange={(i, v) => setWifiTerms(prev => { const n = [...prev]; n[i] = v; return n })}
                />
              )}

              {errors.terms && <p className="text-red-500 text-xs flex items-center gap-1">⚠ {errors.terms}</p>}

              {/* Data Privacy Link */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-600">Data Privacy Notice</p>
                  <p className="text-xs text-gray-400">Your data is handled per Philippine law</p>
                </div>
                <button type="button" onClick={() => setShowPrivacyModal(true)}
                  className="text-xs text-[var(--dict-blue)] font-semibold underline hover:text-blue-800 whitespace-nowrap">
                  View RA 10173 →
                </button>
              </div>
            </div>
          )}

          {/* Date/Time row */}
          <div className="grid grid-cols-3 gap-3 bg-[var(--bg-cream)] rounded-xl p-4">
            <div><p className="text-xs text-gray-400 mb-0.5">Date</p><p className="font-semibold text-gray-800 text-sm">{format(now, 'MMM d, yyyy')}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">Time In</p><p className="font-mono text-[var(--dict-blue)] font-bold text-sm">{format(now, 'hh:mm:ss a')}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">Closes At</p><p className="font-bold text-amber-600 text-sm">{officeCloseStr}</p></div>
          </div>

          {/* Submit */}
          <button onClick={handleNext}
            disabled={form.equipmentUsed.length > 0 && (!pcTermsOk || !wifiTermsOk)}
            className="w-full py-4 rounded-xl bg-[var(--dict-blue)] text-white font-bold hover:bg-blue-800 transition-all shadow-lg shadow-blue-100 text-base disabled:opacity-50 disabled:cursor-not-allowed">
            {!form.equipmentUsed.length ? 'Select a Service to Continue'
              : !pcTermsOk || !wifiTermsOk ? 'Please agree to all terms above'
              : hasPC && hasWifi ? '🖥️ Choose Workstation →'
              : hasPC ? '🖥️ Choose Workstation →'
              : '📶 View WiFi Info →'}
          </button>

          <p className="text-center text-xs text-gray-300">
            Collected per{' '}
            <button onClick={() => setShowPrivacyModal(true)} className="text-[var(--dict-blue)] underline font-medium">Data Privacy Act of 2012 (RA 10173)</button>
          </p>
        </div>

          {/* Hidden staff link */}
          <div className="pb-6 flex justify-center">
            <a href="/admin" className="w-2 h-2 rounded-full bg-gray-200 hover:bg-gray-400 transition-colors" title=""/>
          </div>

          </div>{/* end left column */}

          {/* ── RIGHT COLUMN: info panel (hidden on mobile) ── */}
          <aside className="hidden lg:flex flex-col gap-4 w-80 xl:w-96 flex-shrink-0 sticky top-[88px]">

            {/* Services card */}
            <div className="bg-[var(--dict-blue)] text-white rounded-2xl overflow-hidden shadow-lg">
              <div className="p-5">
                <h3 className="font-display font-bold text-base mb-3">What We Offer</h3>
                <div className="space-y-3">
                  {[
                    { icon: '🌐', title: 'Free Internet Access', desc: 'Fast and reliable connection for government and personal transactions' },
                    { icon: '🖥️', title: 'Free Computer Use', desc: 'Workstations available for research, job applications, and more' },
                    { icon: '📞', title: 'Free Video Calls', desc: 'Stay connected with loved ones via video call services' },
                    { icon: '🧑‍💼', title: 'Staff Assistance', desc: 'Trained staff ready to help with your ICT needs' },
                  ].map(s => (
                    <div key={s.title} className="flex items-start gap-3">
                      <span className="text-xl flex-shrink-0 mt-0.5">{s.icon}</span>
                      <div>
                        <p className="font-semibold text-sm text-white">{s.title}</p>
                        <p className="text-blue-200 text-xs leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white/10 px-5 py-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--dict-gold)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span className="text-white text-xs font-semibold">Monday – Friday · 8:00 AM – 5:00 PM</span>
              </div>
            </div>

            {/* Interactive Banner */}
            <InteractiveBanner
              src={settings?.interactiveBannerUrl || '/interactive-banner.jpg'}
            />

            {/* Announcements */}
            {announcements.length > 0 && (
              <div className="glass rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-[var(--dict-blue)] to-blue-600 border-b border-blue-700 px-4 py-3 flex items-center gap-2">
                  <span className="text-xl">📢</span>
                  <h3 className="font-display font-semibold text-white text-sm">Announcements</h3>
                </div>
                <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                  {announcements.map(a => (
                    <div key={a.id} className={`rounded-xl p-3 border-l-4 ${
                      a.type === 'WARNING' ? 'bg-amber-50 border-amber-500' :
                      a.type === 'MAINTENANCE' ? 'bg-orange-50 border-orange-500' :
                      a.type === 'HOLIDAY' ? 'bg-red-50 border-red-500' :
                      'bg-blue-50 border-blue-500'
                    }`}>
                      <h4 className="font-semibold text-sm text-gray-800 mb-1">{a.title}</h4>
                      <p className="text-xs text-gray-600 leading-relaxed">{a.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Offices card */}
            <div className="glass rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-100 px-4 py-3">
                <h3 className="font-display font-semibold text-gray-700 text-sm">DTC Offices in Bicol Region</h3>
              </div>
              <div className="p-4 space-y-2.5">
                {[
                  { loc: 'Legazpi City, Albay', addr: '2/F Post Telecom Bldg., Lapu Lapu St.' },
                  { loc: 'Camarines Sur', addr: 'P. Bustamante Rd., Sto. Domingo, Camaligan' },
                  { loc: 'Camarines Norte', addr: 'DICT Bldg., Carlos II Rd., Brgy. III, Daet' },
                  { loc: 'Catanduanes', addr: 'Catnet Bldg., San Isidro Village, Virac' },
                  { loc: 'Masbate City', addr: 'Post Office Compound, Brgy. Bagumbayan' },
                  { loc: 'Sorsogon City', addr: '2/F SNGC Bldg., Flores St., Capitol Compound' },
                ].map(o => (
                  <div key={o.loc} className="flex items-start gap-2">
                    <span className="text-[var(--dict-red)] text-sm flex-shrink-0 mt-0.5">📍</span>
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{o.loc}</p>
                      <p className="text-xs text-gray-400 leading-tight">{o.addr}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact card */}
            <div className="glass rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
              <h3 className="font-display font-semibold text-gray-700 text-sm mb-3">Contact Us</h3>
              {[
                { icon: '📧', label: 'region5@dict.gov.ph' },
                { icon: '📞', label: '+63 929 606 5491' },
                { icon: '🌐', label: 'dict.gov.ph' },
              ].map(c => (
                <div key={c.label} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-base flex-shrink-0">{c.icon}</span>
                  <span className="text-xs">{c.label}</span>
                </div>
              ))}
              <div className="pt-3 mt-1 border-t border-gray-100">
                <p className="text-xs text-gray-400 text-center leading-relaxed">
                  Powered by the Department of Information and Communications Technology
                </p>
              </div>
            </div>

          </aside>{/* end right column */}

        </div>{/* end two-column flex */}
      </main>

      {/* Voice Assistant - restricted to logbook form actions only */}
      <VoiceAssistant
        context="logbook-form"
        onCommand={handleVoiceCommand}
        onTranscript={(text) => setVoiceTranscript(text)}
      />

      {/* PC Count Modal - triggered by voice command */}
      <PCCountModal
        isOpen={showPCCountModal}
        onClose={() => setShowPCCountModal(false)}
        pcs={pcs}
      />
    </div>
  )
}
