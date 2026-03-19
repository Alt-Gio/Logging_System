'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Intern = {
  id: string
  fullName: string
  school: string
  course: string
  status: string
  totalHours: number
  requiredHours: number
  photoUrl: string | null
  attendance: AttendanceRecord[]
}

type AttendanceRecord = {
  id: string
  date: string
  timeIn: string | null
  timeOut: string | null
  hours: number | null
  status: string
}

type ClockEntry = {
  internId: string
  startTime: string
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function Avatar({ name, photo, size = 'md' }: { name: string; photo?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sz = { sm: 'w-9 h-9 text-sm', md: 'w-12 h-12 text-base', lg: 'w-16 h-16 text-xl', xl: 'w-24 h-24 text-3xl' }[size]
  const colors = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500']
  const color = colors[name.charCodeAt(0) % colors.length]
  if (photo) return <img src={photo} className={`${sz} rounded-2xl object-cover`} alt={name} />
  return <div className={`${sz} ${color} rounded-2xl flex items-center justify-center text-white font-bold flex-shrink-0`}>{initials(name)}</div>
}

function SkeletonCard() {
  return (
    <div className="p-4 rounded-xl border-2 border-gray-100 bg-gray-50 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-2xl bg-gray-200"/>
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-gray-200 rounded-full w-3/4"/>
          <div className="h-2.5 bg-gray-200 rounded-full w-1/2"/>
        </div>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full"/>
    </div>
  )
}

function WeekBar({ attendance }: { attendance: AttendanceRecord[] }) {
  const today = new Date()
  const dow = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
  monday.setHours(0, 0, 0, 0)
  const days = ['Mon','Tue','Wed','Thu','Fri']
  const bars = days.map((label, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    const hours = attendance.filter(a => a.date.slice(0, 10) === key).reduce((s, a) => s + (a.hours ?? 0), 0)
    return { label, hours, isToday: d.toDateString() === today.toDateString(), isFuture: d > today }
  })
  const weekTotal = bars.reduce((s, b) => s + b.hours, 0)
  return (
    <div className="border-b border-gray-100 px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">This Week</p>
        <p className="text-xs font-bold text-blue-600">{Math.round(weekTotal * 10) / 10}h logged</p>
      </div>
      <div className="flex gap-2">
        {bars.map(b => (
          <div key={b.label} className="flex-1 text-center">
            <div className="relative h-8 rounded-lg overflow-hidden mb-1" style={{background:'#f1f5f9'}}>
              {!b.isFuture && b.hours > 0 && (
                <div className="absolute bottom-0 inset-x-0 rounded-lg transition-all duration-700 bg-blue-500"
                  style={{height:`${Math.min(100,(b.hours/9)*100)}%`}}/>
              )}
              {b.isToday && <div className="absolute inset-0 rounded-lg border-2 border-blue-400"/>}
            </div>
            <p className={`text-[10px] font-bold ${b.isToday ? 'text-blue-500' : 'text-gray-400'}`}>{b.label}</p>
            {b.hours > 0 && <p className="text-[9px] text-gray-400">{Math.round(b.hours*10)/10}h</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 28, circ = 2 * Math.PI * r
  const offset = circ - (Math.min(pct, 100) / 100) * circ
  const color = pct >= 100 ? '#10b981' : pct >= 70 ? '#3b82f6' : pct >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="flex-shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6"/>
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 36 36)" style={{ transition: 'stroke-dashoffset 0.5s ease' }}/>
      <text x="36" y="36" textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="800" fill={color}>{pct}%</text>
    </svg>
  )
}

export default function InternLogbookPage() {
  const [interns, setInterns] = useState<Intern[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Intern | null>(null)
  const [clocks, setClocks] = useState<Record<string, ClockEntry>>({})
  const [elapsed, setElapsed] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [confirmTimeOut, setConfirmTimeOut] = useState<Intern | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [tick, setTick] = useState(0)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchInterns = useCallback(async () => {
    try {
      const r = await fetch('/api/interns?status=ACTIVE')
      const d = await r.json()
      if (Array.isArray(d)) setInterns(d)
    } catch {}
    finally { setLoading(false) }
  }, [])

  // Load interns + restore clock-in state from localStorage
  useEffect(() => {
    fetchInterns()
    try {
      const stored = localStorage.getItem('dtc_intern_clocks')
      if (stored) setClocks(JSON.parse(stored))
    } catch {}
  }, [fetchInterns])

  // Persist clocks to localStorage
  useEffect(() => {
    try { localStorage.setItem('dtc_intern_clocks', JSON.stringify(clocks)) } catch {}
  }, [clocks])

  // Tick every second for elapsed time display
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Compute elapsed for all clocked-in interns
  useEffect(() => {
    const now = Date.now()
    const e: Record<string, number> = {}
    for (const [id, entry] of Object.entries(clocks)) {
      e[id] = now - new Date(entry.startTime).getTime()
    }
    setElapsed(e)
  }, [tick, clocks])

  const handleTimeIn = (intern: Intern) => {
    const startTime = new Date().toISOString()
    setClocks(prev => ({ ...prev, [intern.id]: { internId: intern.id, startTime } }))
    showToast(`⏱ ${intern.fullName.split(' ')[0]} timed in at ${fmtTime(startTime)}`)
  }

  const handleTimeOutConfirmed = async (intern: Intern) => {
    setConfirmTimeOut(null)
    return handleTimeOut(intern)
  }

  const handleTimeOut = async (intern: Intern) => {
    const entry = clocks[intern.id]
    if (!entry) return
    setSaving(true)
    try {
      const timeOut = new Date().toISOString()
      const hours = Math.round(((new Date(timeOut).getTime() - new Date(entry.startTime).getTime()) / 3600000) * 100) / 100
      const r = await fetch(`/api/interns/${intern.id}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: entry.startTime.slice(0, 10),
          timeIn: entry.startTime,
          timeOut,
          hours,
          status: 'PRESENT',
          notes: 'Self-logged via intern kiosk',
        }),
      })
      if (!r.ok) { showToast('Failed to save. Try again.', false); return }
      setClocks(prev => { const n = { ...prev }; delete n[intern.id]; return n })
      showToast(`✓ ${intern.fullName.split(' ')[0]} timed out — ${hours}h logged!`)
      await fetchInterns()
      // Update selected intern with fresh data
      const updated = await fetch('/api/interns?status=ACTIVE').then(r => r.json())
      if (Array.isArray(updated)) {
        setInterns(updated)
        if (selected?.id === intern.id) setSelected(updated.find((i: Intern) => i.id === intern.id) ?? null)
      }
    } catch { showToast('Network error — could not save.', false) }
    finally { setSaving(false) }
  }

  const isClockedIn = (id: string) => !!clocks[id]

  // Today's records for a given intern
  const todayRecords = (intern: Intern) => {
    const today = new Date().toISOString().slice(0, 10)
    return intern.attendance.filter(a => a.date.slice(0, 10) === today)
  }

  const activeInterns = interns.filter(i => i.status === 'ACTIVE')
  const clockedInInterns = activeInterns.filter(i => isClockedIn(i.id))
  const filtered = activeInterns
    .filter(i =>
      i.fullName.toLowerCase().includes(search.toLowerCase()) ||
      i.school.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const aIn = isClockedIn(a.id), bIn = isClockedIn(b.id)
      if (aIn && !bIn) return -1
      if (!aIn && bIn) return 1
      return a.fullName.localeCompare(b.fullName)
    })

  const selIntern = selected ? (interns.find(i => i.id === selected.id) ?? selected) : null
  const selClockedIn = selIntern ? isClockedIn(selIntern.id) : false
  const selEntry = selIntern ? clocks[selIntern.id] : null
  const selPct = selIntern ? Math.round((selIntern.totalHours / selIntern.requiredHours) * 100) : 0
  const selToday = selIntern ? todayRecords(selIntern) : []

  const elapsedHours = (selIntern && selClockedIn) ? ((elapsed[selIntern.id] ?? 0) / 3600000) : 0
  const timerColor = elapsedHours >= 8 ? 'text-red-500' : elapsedHours >= 4 ? 'text-amber-500' : 'text-green-600'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 font-sans">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold flex items-center gap-2 transition-all ${
          toast.ok ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Time Out Confirmation Modal */}
      {confirmTimeOut && clocks[confirmTimeOut.id] && (() => {
        const entry = clocks[confirmTimeOut.id]
        const nowMs = Date.now()
        const durationMs = nowMs - new Date(entry.startTime).getTime()
        const hours = Math.round((durationMs / 3600000) * 100) / 100
        const h = Math.floor(durationMs / 3600000)
        const m = Math.floor((durationMs % 3600000) / 60000)
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setConfirmTimeOut(null)}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="bg-gradient-to-br from-red-50 to-rose-50 px-6 pt-7 pb-5 text-center">
                <div className="w-14 h-14 rounded-full bg-white border-2 border-red-200 flex items-center justify-center mx-auto mb-3 text-2xl shadow-sm">⏱️</div>
                <h2 className="font-black text-gray-900 text-xl">Confirm Time Out</h2>
                <p className="text-gray-500 text-sm mt-1">{confirmTimeOut.fullName}</p>
              </div>
              <div className="p-6 space-y-3">
                <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Time In</span>
                    <span className="font-bold text-gray-800">{fmtTime(entry.startTime)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Time Out</span>
                    <span className="font-bold text-red-600">{fmtTime(new Date().toISOString())}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-2.5 flex justify-between items-center">
                    <span className="text-gray-500">Duration</span>
                    <span className="font-black text-lg text-gray-800">{h}h {m}m</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Hours to log</span>
                    <span className="font-black text-green-600 text-lg">{hours}h</span>
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setConfirmTimeOut(null)}
                    className="flex-1 py-3 border-2 border-gray-200 rounded-2xl font-bold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                  <button onClick={() => handleTimeOutConfirmed(confirmTimeOut)} disabled={saving}
                    className="flex-1 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-2xl font-bold hover:shadow-lg transition-all disabled:opacity-60">
                    {saving ? 'Saving…' : 'Time Out'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-black">DTC</div>
            <div>
              <p className="font-bold text-gray-800 text-sm leading-none">Intern Attendance</p>
              <p className="text-xs text-blue-500 font-medium">DICT Region V</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-400 hidden sm:block">{new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <Link href="/" className="text-xs text-gray-400 hover:text-blue-600 transition-colors">← Home</Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* ── Currently Clocked In strip ── */}
        {clockedInInterns.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <p className="text-xs font-black uppercase tracking-widest text-green-700 mb-3 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
              Currently Clocked In ({clockedInInterns.length})
            </p>
            <div className="flex flex-wrap gap-3">
              {clockedInInterns.map(intern => (
                <button key={intern.id} onClick={() => setSelected(intern)}
                  className="flex items-center gap-2.5 bg-white border border-green-200 rounded-xl px-3 py-2 hover:border-green-400 hover:shadow-sm transition-all group">
                  <Avatar name={intern.fullName} photo={intern.photoUrl} size="sm" />
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-800">{intern.fullName.split(' ')[0]}</p>
                    <p className="text-xs font-mono text-green-600 font-semibold">{fmt(elapsed[intern.id] ?? 0)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Selected Intern Card ── */}
        {selIntern ? (
          <div className={`rounded-2xl border-2 overflow-hidden shadow-md transition-all ${selClockedIn ? 'border-green-300 bg-white' : 'border-blue-200 bg-white'}`}>
            {/* Intern info bar */}
            <div className={`px-6 py-4 flex items-center gap-4 border-b ${selClockedIn ? 'bg-green-50 border-green-100' : 'bg-blue-50 border-blue-100'}`}>
              <Avatar name={selIntern.fullName} photo={selIntern.photoUrl} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="font-black text-gray-900 text-xl leading-tight">{selIntern.fullName}</p>
                <p className="text-sm text-gray-500 mt-0.5">{selIntern.course}</p>
                <p className="text-xs text-gray-400">{selIntern.school}</p>
              </div>
              <ProgressRing pct={selPct} />
              <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-500 text-2xl leading-none ml-2">×</button>
            </div>

            {/* Week summary */}
            <WeekBar attendance={selIntern.attendance} />

            {/* Hours summary */}
            <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
              {[
                { label: 'Hours Logged', val: `${Math.round(selIntern.totalHours * 10) / 10}h`, sub: `of ${selIntern.requiredHours}h required` },
                { label: 'Remaining', val: `${Math.max(0, Math.round((selIntern.requiredHours - selIntern.totalHours) * 10) / 10)}h`, sub: `${selPct >= 100 ? '🎉 Complete!' : 'to go'}` },
                { label: 'Days Present', val: selIntern.attendance.filter(a => a.status === 'PRESENT').length, sub: 'total records' },
              ].map(s => (
                <div key={s.label} className="px-4 py-3 text-center">
                  <p className="text-lg font-black text-gray-800">{s.val}</p>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{s.label}</p>
                  <p className="text-[10px] text-gray-400">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Time In / Out */}
            <div className="p-6">
              {selClockedIn && selEntry ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-xs font-semibold text-green-600 uppercase tracking-widest mb-1">⏱ Time Elapsed</p>
                    <p className={`font-mono font-black text-6xl tracking-widest tabular-nums leading-none transition-colors duration-1000 ${timerColor}`}>
                      {fmt(elapsed[selIntern.id] ?? 0)}
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                      Clocked in at <strong className="text-gray-600">{fmtTime(selEntry.startTime)}</strong> · {fmtDate(selEntry.startTime)}
                    </p>
                  </div>
                  <button onClick={() => setConfirmTimeOut(selIntern)} disabled={saving}
                    className="w-full py-4 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-2xl font-black text-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-60 flex items-center justify-center gap-3">
                    {saving
                      ? <><span className="inline-block w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"/> Saving…</>
                      : <><span className="w-3 h-3 rounded-sm bg-white"/>  TIME OUT</>
                    }
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center text-gray-400 text-sm">
                    <p>Not clocked in today</p>
                    {selToday.length > 0 && (
                      <p className="text-xs mt-1 text-blue-500">{selToday.length} session{selToday.length !== 1 ? 's' : ''} logged today</p>
                    )}
                  </div>
                  <button onClick={() => handleTimeIn(selIntern)}
                    className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-black text-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-white"/> TIME IN
                  </button>
                </div>
              )}
            </div>

            {/* Today's log + recent history */}
            <div className="border-t border-gray-100 px-6 pb-5">
              {selToday.length > 0 && (
                <>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-4 mb-3">Today&apos;s Sessions</p>
                  <div className="space-y-2 mb-4">
                    {selToday.map(a => (
                      <div key={a.id} className="flex items-center gap-3 text-sm bg-gray-50 rounded-xl px-4 py-2.5">
                        <span className="text-green-500 font-bold text-base">✓</span>
                        <span className="font-mono text-gray-600 text-xs">
                          {a.timeIn ? fmtTime(a.timeIn) : '—'} → {a.timeOut ? fmtTime(a.timeOut) : <span className="text-green-500 font-semibold animate-pulse">ongoing</span>}
                        </span>
                        {a.hours && <span className="ml-auto font-bold text-blue-600 text-xs">{a.hours}h</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {selIntern.attendance.length > 0 && (() => {
                const recent = selIntern.attendance
                  .slice()
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 5)
                return (
                  <details className="group mt-2">
                    <summary className="text-xs font-semibold text-blue-500 cursor-pointer hover:text-blue-700 list-none flex items-center gap-1 select-none">
                      <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                      Recent Attendance ({selIntern.attendance.length} records)
                    </summary>
                    <div className="mt-3 overflow-x-auto rounded-xl border border-gray-100">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            {['Date','Time In','Time Out','Hours','Status'].map(h => (
                              <th key={h} className="text-left text-[10px] font-bold text-gray-400 uppercase px-3 py-2">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {recent.map(a => (
                            <tr key={a.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-semibold text-gray-700">{new Date(a.date).toLocaleDateString('en-PH',{month:'short',day:'numeric'})}</td>
                              <td className="px-3 py-2 font-mono text-gray-500">{a.timeIn ? fmtTime(a.timeIn) : '—'}</td>
                              <td className="px-3 py-2 font-mono text-gray-500">{a.timeOut ? fmtTime(a.timeOut) : '—'}</td>
                              <td className="px-3 py-2 font-bold text-gray-800">{a.hours ? `${a.hours}h` : '—'}</td>
                              <td className="px-3 py-2">
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  a.status==='PRESENT' ? 'bg-green-100 text-green-700' :
                                  a.status==='ABSENT'  ? 'bg-red-100 text-red-600' :
                                  'bg-gray-100 text-gray-600'
                                }`}>{a.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )
              })()}
            </div>
          </div>
        ) : (
          /* ── Intern Selection ── */
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h1 className="font-black text-2xl text-gray-900">Find Your Name</h1>
              <p className="text-gray-400 text-sm mt-1">Select your name below to time in or out.</p>
              <div className="relative mt-4">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 text-lg">🔍</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && filtered.length > 0) setSelected(filtered[0]) }}
                  placeholder="Search by name or school…"
                  className="w-full border-2 border-gray-200 rounded-xl pl-11 pr-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors"
                  autoFocus
                />
              </div>
            </div>

            {loading ? (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {Array.from({length:6}).map((_,i) => <SkeletonCard key={i}/>)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-4xl mb-3">🔍</p>
                <p className="text-gray-400 text-sm font-medium">No interns match &quot;{search}&quot;</p>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[480px] overflow-y-auto">
                {filtered.map(intern => {
                  const pct = Math.round((intern.totalHours / intern.requiredHours) * 100)
                  const clocked = isClockedIn(intern.id)
                  return (
                    <button key={intern.id} onClick={() => setSelected(intern)}
                      className={`text-left p-4 rounded-xl border-2 transition-all hover:shadow-md hover:-translate-y-0.5 group ${
                        clocked ? 'border-green-300 bg-green-50' : 'border-gray-100 hover:border-blue-300 bg-gray-50 hover:bg-white'
                      }`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="relative">
                          <Avatar name={intern.fullName} photo={intern.photoUrl} size="md" />
                          {clocked && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white animate-pulse"/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-sm leading-tight truncate">{intern.fullName}</p>
                          <p className="text-xs text-gray-400 truncate">{intern.school}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="h-1.5 flex-1 bg-gray-200 rounded-full overflow-hidden mr-2">
                          <div className={`h-1.5 rounded-full transition-all ${
                            pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-400'
                          }`} style={{ width: `${Math.min(pct, 100)}%` }}/>
                        </div>
                        <span className={`text-xs font-bold whitespace-nowrap ${clocked ? 'text-green-600' : 'text-gray-400'}`}>
                          {clocked ? `⏱ ${fmt(elapsed[intern.id] ?? 0)}` : `${Math.round(intern.totalHours)}h/${intern.requiredHours}h`}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-300 pb-4">
          DICT Region V Intern Attendance Kiosk · <Link href="/interns" className="hover:text-blue-400 transition-colors">Admin View</Link>
        </p>
      </main>
    </div>
  )
}
