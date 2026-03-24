'use client'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useState, useEffect, useRef } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────
type Screen = 'select' | 'home' | 'active' | 'timeout'

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtElapsed(ms: number) {
  const s   = Math.floor(ms / 1000)
  const h   = Math.floor(s / 3600)
  const m   = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}
function fmtClock(d = new Date()) {
  return d.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false })
}
function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit', hour12: true })
}
function fmtHours(ms: number) {
  const h  = ms / 3_600_000
  const fh = Math.floor(h)
  const fm = Math.round((h - fh) * 60)
  return `${fh}h${fm > 0 ? ` ${fm}m` : ''}`
}
function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}
function minsUntil5PM() {
  const now = new Date(), end = new Date(now)
  end.setHours(17, 0, 0, 0)
  return Math.floor((end.getTime() - now.getTime()) / 60_000)
}
function initials(name: string) {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

const INTERN_KEY = 'dtc_intern_portal_id'

// ── Main component ─────────────────────────────────────────────────────────
export default function InternPortal() {
  const [screen,   setScreen]   = useState<Screen>('select')
  const [internId, setInternId] = useState<Id<'interns'> | null>(null)
  const [search,   setSearch]   = useState('')
  const [elapsed,  setElapsed]  = useState(0)
  const [clock,    setClock]    = useState(fmtClock())
  const [note,     setNote]     = useState('')
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Convex real-time queries ──────────────────────────────────────────────
  const interns       = useQuery(api.interns.getAll, { status: 'ACTIVE' })
  const announcements = useQuery(api.announcements.getActive)
  const activeSession = useQuery(
    api.internSessions.getActiveSession,
    internId ? { internId } : 'skip',
  )
  const tasks = useQuery(
    api.internTasks.getTasksForIntern,
    internId ? { internId } : 'skip',
  )

  // ── Convex mutations ──────────────────────────────────────────────────────
  const timeInMutation     = useMutation(api.internSessions.timeIn)
  const timeOutMutation    = useMutation(api.internSessions.timeOut)
  const updateTaskMutation = useMutation(api.internTasks.updateTaskStatus)

  // ── Derived values ────────────────────────────────────────────────────────
  const intern   = interns?.find(i => i._id === internId) ?? null
  const announce = announcements?.[0] ?? null
  const done     = (tasks ?? []).filter(t => t.status === 'COMPLETED')
  const mins     = minsUntil5PM()
  const fname    = intern?.fullName.split(' ')[0] ?? ''
  const loading  = internId !== null && activeSession === undefined

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3200) }

  // ── Clock tick ───────────────────────────────────────────────────────────
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setClock(fmtClock())
      if (activeSession) setElapsed(Date.now() - activeSession.timeIn)
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?._id])

  // ── Restore intern from localStorage once interns list loads ─────────────
  useEffect(() => {
    if (!interns || interns.length === 0) return
    const saved = localStorage.getItem(INTERN_KEY)
    if (saved) {
      const found = interns.find(i => i._id === saved)
      if (found) { setInternId(found._id); setScreen('home') }
    }
  }, [interns])

  // ── React to active session loading — switch screen ──────────────────────
  useEffect(() => {
    if (!internId || activeSession === undefined) return
    if (activeSession) {
      setElapsed(Date.now() - activeSession.timeIn)
      setScreen(prev => prev === 'timeout' ? 'timeout' : 'active')
    } else {
      setScreen(prev => (prev === 'select' || prev === 'timeout') ? 'home' : prev)
    }
  }, [internId, activeSession?._id])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const selectIntern = (i: NonNullable<typeof interns>[number]) => {
    setInternId(i._id)
    localStorage.setItem(INTERN_KEY, i._id)
    setScreen('home')
  }

  const handleTimeIn = async () => {
    if (!internId) return
    try {
      await timeInMutation({ internId })
      setElapsed(0)
      showToast('Session started ✓')
    } catch { showToast('Failed to start session') }
  }

  const handleToggleTask = async (task: NonNullable<typeof tasks>[number]) => {
    const newStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
    try {
      await updateTaskMutation({
        taskId: task._id,
        status: newStatus as 'PENDING' | 'COMPLETED',
      })
    } catch { showToast('Failed to update task') }
  }

  const handleSubmitSignOut = async () => {
    if (!activeSession || !note.trim()) return
    setSaving(true)
    try {
      await timeOutMutation({
        sessionId:    activeSession._id,
        progressNote: note.trim(),
        closedBy:     'intern',
      })
      setNote('')
      setScreen('home')
      showToast('Signed out successfully ✓')
    } catch { showToast('Network error') }
    setSaving(false)
  }

  const clearIntern = () => {
    setInternId(null); setNote('')
    setScreen('select'); localStorage.removeItem(INTERN_KEY)
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center pb-10"
         style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm
                        font-semibold px-5 py-3 rounded-2xl shadow-2xl animate-bounce-once">
          {toast}
        </div>
      )}

      {/* ── SELECT ─────────────────────────────────────────── */}
      {screen === 'select' && (
        <div className="w-full max-w-sm mx-auto px-5 pt-10 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-[#0038A8] flex items-center justify-center shadow-lg">
              <img src="/dict-seal.png" alt="DICT" className="w-8 h-8 object-contain"
                   onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">DICT Region V</p>
              <p className="text-sm font-extrabold text-[#0038A8] leading-tight">Intern Logbook</p>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Who are you?</h1>
            <p className="text-sm text-gray-500 mt-1">Select your name to get started.</p>
          </div>

          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search your name…" autoFocus
            className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200
                       focus:border-[#0038A8] outline-none text-sm bg-white shadow-sm"
          />

          <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-0.5">
            {(interns ?? []).filter(i =>
              i.fullName.toLowerCase().includes(search.toLowerCase()) ||
              (i.school || '').toLowerCase().includes(search.toLowerCase())
            ).map(i => (
              <button key={i._id} onClick={() => selectIntern(i)} disabled={loading}
                className="w-full flex items-center gap-3 p-3.5 bg-white rounded-2xl border-2
                           border-gray-100 hover:border-[#0038A8] hover:bg-blue-50
                           transition-all text-left active:scale-95">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0038A8] to-[#0050d0]
                                flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0">
                  {initials(i.fullName)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate">{i.fullName}</p>
                  <p className="text-xs text-gray-500 truncate">{i.school}{i.department ? ` · ${i.department}` : ''}</p>
                </div>
                <span className="ml-auto text-gray-300 text-lg">›</span>
              </button>
            ))}
            {(interns ?? []).length === 0 && (
              <p className="text-center text-gray-400 text-sm py-12">{interns === undefined ? 'Loading…' : 'No interns registered yet.'}</p>
            )}
          </div>
        </div>
      )}

      {/* ── HOME (no session) ─────────────────────────────── */}
      {screen === 'home' && intern && (
        <div className="w-full max-w-sm mx-auto px-5 pt-6 space-y-4">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#0038A8] flex items-center justify-center">
                <img src="/dict-seal.png" className="w-5 h-5 object-contain"
                     onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              </div>
              <span className="text-xs font-extrabold text-[#0038A8]">Intern Logbook</span>
            </div>
            <span className="text-sm font-mono font-bold text-gray-500">{clock}</span>
          </div>

          {/* Announcement */}
          {announce && (
            <div className="bg-[#0038A8] rounded-2xl p-4 flex items-start gap-3 shadow-md">
              <span className="text-xl mt-0.5">📢</span>
              <div>
                <p className="font-bold text-white text-sm leading-snug">{announce.title}</p>
                {announce.content && (
                  <p className="text-white/70 text-xs mt-1 leading-relaxed">{announce.content}</p>
                )}
              </div>
            </div>
          )}

          {/* Greeting */}
          <div className="text-center pt-2 pb-1">
            <p className="text-gray-500 text-sm">{greeting()}</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{intern.fullName}</p>
            <p className="text-xs text-gray-400 mt-1">{intern.school}{intern.department ? ` · ${intern.department}` : ''}</p>
          </div>

          {/* Time In card */}
          <div className="bg-gradient-to-br from-[#0038A8] to-[#0055e0] rounded-3xl p-6 text-center shadow-xl">
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.15em] mb-3">Time In</p>
            <p className="text-5xl font-mono font-extrabold text-white tracking-tight">{clock}</p>
            <button onClick={handleTimeIn} disabled={loading}
              className="mt-5 w-full bg-white text-[#0038A8] font-extrabold py-4 rounded-2xl
                         text-base shadow-lg active:scale-95 transition-all disabled:opacity-50">
              {loading ? '⏳ Starting…' : '▶  Start Session'}
            </button>
            <p className="text-white/50 text-xs mt-2">Tap to start session</p>
          </div>

          {/* Tasks */}
          {(tasks ?? []).length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">My tasks today</p>
              <div className="space-y-2">
                {(tasks ?? []).map(t => (
                  <div key={t._id} className="flex items-center gap-3 bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm">
                    <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all
                      ${t.status === 'COMPLETED' ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                      {t.status === 'COMPLETED' && <span className="text-white text-[10px] font-extrabold">✓</span>}
                    </div>
                    <p className={`text-sm font-medium flex-1 ${t.status === 'COMPLETED' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {t.title}
                    </p>
                    {t.priority === 'HIGH' && (
                      <span className="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">High</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {tasks !== undefined && tasks.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-4">No tasks assigned yet.</div>
          )}

          <button onClick={clearIntern}
            className="w-full text-center text-xs text-gray-400 py-3 hover:text-gray-600">
            Not {fname}? Change intern →
          </button>
        </div>
      )}

      {/* ── ACTIVE SESSION ────────────────────────────────── */}
      {screen === 'active' && intern && activeSession && (
        <div className="w-full max-w-sm mx-auto px-5 pt-6 space-y-4">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
              <span className="text-xs font-bold text-green-600">Session active</span>
            </div>
            <span className="text-xs font-bold text-gray-500 truncate max-w-[130px]">{intern.fullName.split(' ')[0]}</span>
          </div>

          {/* Timer card */}
          <div className="bg-gradient-to-br from-[#0038A8] to-[#0055e0] rounded-3xl p-6 text-center shadow-xl">
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.15em] mb-3">Session active</p>
            <p className="text-5xl font-mono font-extrabold text-white tracking-tight tabular-nums">
              {fmtElapsed(elapsed)}
            </p>
            <p className="text-white/60 text-xs mt-2">Started {fmtTime(activeSession.timeIn)}</p>
          </div>

          {/* 5PM warning */}
          {mins <= 60 && mins > 0 && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-3.5 flex items-center gap-3">
              <span className="text-xl">⏰</span>
              <p className="text-amber-800 text-sm font-bold">Closing at 5:00 PM — {mins} min left</p>
            </div>
          )}
          {mins <= 0 && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-3.5 flex items-center gap-3">
              <span className="text-xl">🔴</span>
              <p className="text-red-700 text-sm font-bold">Past closing time! Please sign out now.</p>
            </div>
          )}

          {/* Tasks */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tasks</p>
              {(tasks ?? []).length > 0 && (
                <span className="text-xs bg-[#0038A8]/10 text-[#0038A8] font-bold px-3 py-1 rounded-full">
                  {done.length} of {(tasks ?? []).length} done
                </span>
              )}
            </div>

            {(tasks ?? []).length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-6">No tasks assigned.</div>
            ) : (
              <div className="space-y-2">
                {(tasks ?? []).map(t => (
                  <button key={t._id} onClick={() => handleToggleTask(t)}
                    className="w-full flex items-center gap-3 bg-white rounded-2xl p-3.5 border border-gray-100
                               shadow-sm text-left active:scale-95 transition-all">
                    <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all
                      ${t.status === 'COMPLETED' ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-[#0038A8]'}`}>
                      {t.status === 'COMPLETED' && <span className="text-white text-[10px] font-extrabold">✓</span>}
                    </div>
                    <span className={`text-sm font-medium flex-1 ${t.status === 'COMPLETED' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {t.title}
                    </span>
                    {t.priority === 'HIGH' && (
                      <span className="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">High</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Time Out button */}
          <button onClick={() => setScreen('timeout')}
            className="w-full bg-gradient-to-r from-red-500 to-rose-600 text-white font-extrabold
                       py-4 rounded-2xl text-base shadow-lg active:scale-95 transition-all mt-2">
            ⏹  Time Out
          </button>

          <button onClick={clearIntern}
            className="w-full text-center text-xs text-gray-400 py-2 hover:text-gray-600">
            Not {fname}? Switch intern →
          </button>
        </div>
      )}

      {/* ── TIME OUT / SIGN OUT ───────────────────────────── */}
      {screen === 'timeout' && intern && activeSession && (
        <div className="w-full max-w-sm mx-auto px-5 pt-6 space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-extrabold text-gray-900">Time Out</h1>
            <span className="text-sm font-mono text-gray-500">{fmtClock()}</span>
          </div>

          {/* Summary */}
          <div className="bg-gray-900 rounded-2xl p-4">
            <p className="text-white font-bold text-sm">
              End of day — {fmtTime(activeSession.timeIn)} to {new Date().toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit', hour12: true })}
            </p>
            <p className="text-gray-400 text-xs mt-1">{fmtHours(elapsed)}</p>
          </div>

          {/* Progress note */}
          <div>
            <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-2">
              What did you accomplish today? <span className="text-red-500">*</span>
            </label>
            <textarea
              value={note} onChange={e => setNote(e.target.value)}
              placeholder="e.g. Finished updating client DB. Helped 8 walk-in clients with PhilSys."
              rows={4} autoFocus
              className="w-full border-2 border-gray-200 focus:border-[#0038A8] rounded-2xl
                         px-4 py-3 text-sm outline-none resize-none bg-white"
            />
            <p className="text-[11px] text-gray-400 mt-1.5">Saved to your attendance record and visible to your supervisor.</p>
          </div>

          {/* Task summary */}
          {(tasks ?? []).length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Tasks completed today</p>
              <div className="flex flex-wrap gap-2">
                {(tasks ?? []).map(t => (
                  <span key={t._id} className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                    t.status === 'COMPLETED'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-400 line-through'
                  }`}>
                    {t.title.length > 22 ? t.title.slice(0, 22) + '…' : t.title}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Submit */}
          <button onClick={handleSubmitSignOut} disabled={saving || !note.trim()}
            className="w-full bg-[#0038A8] text-white font-extrabold py-4 rounded-2xl text-base
                       shadow-lg disabled:opacity-40 active:scale-95 transition-all">
            {saving ? '⏳ Saving…' : '✓  Submit & Sign Out'}
          </button>

          <button onClick={() => setScreen('active')}
            className="w-full text-center text-sm text-gray-400 py-2 hover:text-gray-600">
            ← Back to session
          </button>
        </div>
      )}
    </div>
  )
}
