'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────
type Session = { id: string; name: string; email: string; internId: string; role: string }
type Account = { id: string; level: number; xp: number; xpInLevel: number; xpNeeded: number; health: number; streak: number; achievements: string[]; lastActiveDate?: number }
type InternProfile = { id: string; fullName: string; school: string; course: string; department: string | null; photoUrl: string | null; totalHoursLogged: number; requiredHours: number; status: string }
type ActiveSession = { id: string; timeIn: string; status: string } | null
type Task = { id: string; title: string; description: string | null; status: string; priority: string; difficulty: string; xpReward: number; type: string; dueDate: string | null; completedAt: string | null }
type SessionRecord = { id: string; timeIn: string; timeOut: string | null; hoursLogged: number | null; status: string; progressNote: string | null; checkInMethod: string }

const DIFFICULTY_XP: Record<string, number> = { trivial: 5, easy: 10, medium: 20, hard: 40, epic: 100 }
const DIFFICULTY_STARS: Record<string, string> = { trivial: '★', easy: '★★', medium: '★★★', hard: '★★★★', epic: '★★★★★' }
const DIFFICULTY_COLOR: Record<string, string> = { trivial: 'text-gray-400', easy: 'text-green-500', medium: 'text-blue-500', hard: 'text-orange-500', epic: 'text-purple-600' }
const PRIORITY_COLOR: Record<string, string> = { LOW: 'bg-gray-100 text-gray-500', MEDIUM: 'bg-blue-100 text-blue-700', HIGH: 'bg-orange-100 text-orange-700', URGENT: 'bg-red-100 text-red-700' }

function levelTitle(level: number): string {
  if (level >= 21) return 'DICT Legend'
  if (level >= 16) return 'DTC Elite'
  if (level >= 11) return 'ICT Champion'
  if (level >= 6)  return 'Digital Advocate'
  return 'OJT Beginner'
}
function levelColor(level: number): string {
  if (level >= 21) return 'from-yellow-400 to-orange-500'
  if (level >= 16) return 'from-purple-500 to-pink-500'
  if (level >= 11) return 'from-blue-500 to-cyan-500'
  if (level >= 6)  return 'from-green-500 to-teal-500'
  return 'from-gray-400 to-gray-500'
}

// ── Sub-components ────────────────────────────────────────────────────────────
function XPBar({ xpInLevel, xpNeeded, small }: { xpInLevel: number; xpNeeded: number; small?: boolean }) {
  const pct = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100))
  return (
    <div className={`w-full bg-black/20 rounded-full overflow-hidden ${small ? 'h-1.5' : 'h-3'}`}>
      <div
        className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 transition-all duration-700 ease-out rounded-full"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function HealthBar({ health, small }: { health: number; small?: boolean }) {
  const color = health > 60 ? 'from-green-400 to-emerald-500' : health > 30 ? 'from-yellow-400 to-amber-500' : 'from-red-400 to-rose-500'
  return (
    <div className={`w-full bg-black/20 rounded-full overflow-hidden ${small ? 'h-1.5' : 'h-3'}`}>
      <div
        className={`h-full bg-gradient-to-r ${color} transition-all duration-700 rounded-full`}
        style={{ width: `${health}%` }}
      />
    </div>
  )
}

function LevelBadge({ level, size = 'md' }: { level: number; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'text-3xl font-black px-4 py-2' : size === 'md' ? 'text-sm font-bold px-2.5 py-1' : 'text-xs font-bold px-2 py-0.5'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r ${levelColor(level)} text-white shadow-lg ${cls}`}>
      Lv.{level}
    </span>
  )
}

function TaskCard({ task, onStatusChange, loading }: { task: Task; onStatusChange: (id: string, status: string) => void; loading: boolean }) {
  const nextStatus: Record<string, string> = { PENDING: 'IN_PROGRESS', IN_PROGRESS: 'COMPLETED' }
  const statusLabel: Record<string, string> = { PENDING: 'Start', IN_PROGRESS: 'Mark Done ✓', COMPLETED: 'Done' }
  const statusBg: Record<string, string> = { PENDING: 'bg-gray-50 border-gray-200', IN_PROGRESS: 'bg-blue-50 border-blue-200', COMPLETED: 'bg-green-50 border-green-200' }
  const isDone = task.status === 'COMPLETED'

  return (
    <div className={`rounded-2xl border-2 p-4 transition-all ${statusBg[task.status] ?? 'bg-white border-gray-200'} ${isDone ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${isDone ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
          {isDone && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12"><path fill="currentColor" d="M10 3L5 8.5 2 5.5 1 6.5 5 10.5 11 4z"/></svg>}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm leading-snug ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</p>
          {task.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{task.description}</p>}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-xs font-bold ${DIFFICULTY_COLOR[task.difficulty] ?? 'text-gray-500'}`}>{DIFFICULTY_STARS[task.difficulty] ?? '★'}</span>
            <span className="text-xs text-amber-600 font-bold">+{task.xpReward} XP</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[task.priority] ?? ''}`}>{task.priority}</span>
            {task.dueDate && (
              <span className="text-xs text-gray-400">Due {new Date(task.dueDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
            )}
          </div>
        </div>
        {!isDone && nextStatus[task.status] && (
          <button
            onClick={() => onStatusChange(task.id, nextStatus[task.status])}
            disabled={loading}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all disabled:opacity-50 ${task.status === 'IN_PROGRESS' ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
          >
            {statusLabel[task.status]}
          </button>
        )}
      </div>
    </div>
  )
}

function AchievementBadge({ badge }: { badge: string }) {
  const badges: Record<string, { icon: string; label: string; color: string }> = {
    first_timer:   { icon: '🌟', label: 'First Timer',    color: 'bg-yellow-50 border-yellow-200' },
    task_master:   { icon: '⚡', label: 'Task Master',    color: 'bg-blue-50 border-blue-200' },
    streak_keeper: { icon: '🔥', label: 'Streak Keeper',  color: 'bg-orange-50 border-orange-200' },
    punctual:      { icon: '⏰', label: 'Punctual',       color: 'bg-green-50 border-green-200' },
    level_5:       { icon: '📡', label: 'Digital Advocate', color: 'bg-teal-50 border-teal-200' },
    level_10:      { icon: '🏆', label: 'ICT Champion',   color: 'bg-indigo-50 border-indigo-200' },
    level_20:      { icon: '👑', label: 'DICT Legend',    color: 'bg-purple-50 border-purple-200' },
  }
  const b = badges[badge] ?? { icon: '🎖️', label: badge, color: 'bg-gray-50 border-gray-200' }
  return (
    <div className={`flex flex-col items-center p-3 rounded-2xl border-2 ${b.color} gap-1`}>
      <span className="text-2xl">{b.icon}</span>
      <span className="text-xs font-semibold text-gray-600 text-center leading-tight">{b.label}</span>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InternDashboardPage() {
  const router = useRouter()

  const [session,       setSession]       = useState<Session | null>(null)
  const [account,       setAccount]       = useState<Account | null>(null)
  const [intern,        setIntern]        = useState<InternProfile | null>(null)
  const [activeSession, setActiveSession] = useState<ActiveSession>(null)
  const [tasks,         setTasks]         = useState<Task[]>([])
  const [unreadCount,   setUnreadCount]   = useState(0)
  const [loading,       setLoading]       = useState(true)
  const [taskLoading,   setTaskLoading]   = useState(false)
  const [sessionLoading,setSessionLoading]= useState(false)
  const [tab,           setTab]           = useState<'today' | 'tasks' | 'progress' | 'leaderboard'>('today')
  const [leaderboard,   setLeaderboard]   = useState<{id:string;internName:string;level:number;xp:number;streak:number;internPhoto?:string}[]>([])
  const [progressNote,  setProgressNote]  = useState('')
  const [showTimeout,   setShowTimeout]   = useState(false)
  const [elapsed,       setElapsed]       = useState(0)
  const [toast,         setToast]         = useState<{msg:string;type:'success'|'error'}|null>(null)
  const [announcements,   setAnnouncements]   = useState<{id:string;title:string;body:string;type:string}[]>([])
  const [recentSessions,  setRecentSessions]  = useState<SessionRecord[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadDashboard = useCallback(async () => {
    try {
      const [sessRes, dataRes, annRes] = await Promise.all([
        fetch('/api/intern-auth/session'),
        fetch('/api/intern-accounts/me'),
        fetch('/api/announcements'),
      ])
      const sess = await sessRes.json()
      if (!sess || sess.role !== 'INTERN') { router.push('/intern/login'); return }
      setSession(sess)
      if (dataRes.ok) {
        const d = await dataRes.json()
        setAccount(d.account)
        setIntern(d.intern)
        setActiveSession(d.activeSession)
        setTasks(d.tasks)
        setUnreadCount(d.unreadNotifications)
        if (Array.isArray(d.recentSessions)) setRecentSessions(d.recentSessions)
      }
      if (annRes.ok) {
        const a = await annRes.json()
        setAnnouncements((a ?? []).filter((x: {active:boolean}) => x.active).slice(0, 3))
      }
    } catch {
      /* swallow */
    } finally {
      setLoading(false)
    }
  }, [router])

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/intern-accounts/leaderboard')
      if (res.ok) setLeaderboard(await res.json())
    } catch { /* swallow */ }
  }, [])

  // Initial load + 30s polling
  useEffect(() => {
    loadDashboard()
    const poll = setInterval(loadDashboard, 30_000)
    return () => clearInterval(poll)
  }, [loadDashboard])

  useEffect(() => {
    if (tab === 'leaderboard') loadLeaderboard()
  }, [tab, loadLeaderboard])

  // Session timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (activeSession) {
      const update = () => setElapsed(Math.floor((Date.now() - new Date(activeSession.timeIn).getTime()) / 1000))
      update()
      timerRef.current = setInterval(update, 1000)
    } else {
      setElapsed(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [activeSession])

  async function handleTimeIn() {
    if (!intern) return
    setSessionLoading(true)
    try {
      const res = await fetch('/api/intern-sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internId: intern.id }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Could not time in', 'error'); return }
      await loadDashboard()
      showToast('✅ Timed in! Have a great session.')
      // Award time-in XP
      await fetch('/api/intern-accounts/award-xp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'time_in', xp: 5 }),
      })
    } catch { showToast('Network error', 'error') } finally { setSessionLoading(false) }
  }

  async function handleTimeOut() {
    if (!activeSession || !intern) return
    if (!progressNote.trim()) { showToast('Please write a progress note', 'error'); return }
    setSessionLoading(true)
    try {
      const res = await fetch(`/api/intern-sessions/${activeSession.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progressNote }),
      })
      if (!res.ok) { showToast('Could not time out', 'error'); return }
      setShowTimeout(false)
      setProgressNote('')
      await loadDashboard()
      showToast('👋 Timed out. Great work today!')
    } catch { showToast('Network error', 'error') } finally { setSessionLoading(false) }
  }

  async function handleTaskStatus(taskId: string, newStatus: string) {
    setTaskLoading(true)
    try {
      const res = await fetch(`/api/intern-tasks/${taskId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) { showToast('Could not update task', 'error'); return }
      if (newStatus === 'COMPLETED') {
        const task = tasks.find(t => t.id === taskId)
        if (task) {
          await fetch('/api/intern-accounts/award-xp', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'task_completed', xp: task.xpReward, taskId }),
          })
          showToast(`+${task.xpReward} XP earned! 🎉`)
        }
      }
      await loadDashboard()
    } catch { showToast('Network error', 'error') } finally { setTaskLoading(false) }
  }

  function fmtElapsed(s: number) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0038A8, #001f5c)' }}>
        <div className="text-center text-white">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-blue-200 text-sm">Loading your dashboard…</p>
        </div>
      </div>
    )
  }

  if (!session || !account || !intern) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0038A8, #001f5c)' }}>
        <div className="text-white text-center">
          <p className="mb-4">Session expired</p>
          <a href="/intern/login" className="underline text-blue-200">Sign in again</a>
        </div>
      </div>
    )
  }

  const todayTasks   = tasks.filter(t => t.status !== 'COMPLETED' && t.type !== 'habit')
  const pendingTasks = tasks.filter(t => t.status === 'PENDING')
  const inProgress   = tasks.filter(t => t.status === 'IN_PROGRESS')
  const doneTasks    = tasks.filter(t => t.status === 'COMPLETED')
  const hoursLeft    = Math.max(0, intern.requiredHours - intern.totalHoursLogged)
  const hoursPct     = Math.min(100, Math.round((intern.totalHoursLogged / intern.requiredHours) * 100))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white transition-all ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Time-out modal */}
      {showTimeout && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setShowTimeout(false)}>
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-xl text-gray-800 mb-1">Time Out</h3>
            <p className="text-sm text-gray-400 mb-4">Session: {fmtElapsed(elapsed)} · Write a note about what you did today.</p>
            <textarea
              value={progressNote}
              onChange={e => setProgressNote(e.target.value)}
              placeholder="Describe tasks completed, progress made, or challenges encountered…"
              rows={4}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-sm resize-none"
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowTimeout(false)} className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleTimeOut} disabled={sessionLoading || !progressNote.trim()} className="flex-[2] py-3 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 disabled:opacity-50">
                {sessionLoading ? 'Timing out…' : 'Confirm Time Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0038A8 0%, #001f5c 100%)' }} className="pt-safe">
        <div className="max-w-lg mx-auto px-4 py-5">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-white/30 overflow-hidden flex items-center justify-center flex-shrink-0">
                {intern.photoUrl
                  ? <img src={intern.photoUrl} alt="" className="w-full h-full object-cover" />
                  : <span className="text-white font-bold text-sm">{intern.fullName[0]}</span>}
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">{intern.fullName}</p>
                <p className="text-blue-300 text-xs">{intern.department ?? intern.school}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {account.streak > 0 && (
                <div className="flex items-center gap-1 bg-orange-500/20 border border-orange-400/30 px-2 py-1 rounded-full">
                  <span className="text-sm">🔥</span>
                  <span className="text-orange-300 text-xs font-bold">{account.streak}</span>
                </div>
              )}
              <button className="relative w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                <span className="text-lg">🔔</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Level + Stats */}
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <LevelBadge level={account.level} size="md" />
                <p className="text-blue-200 text-xs mt-0.5">{levelTitle(account.level)}</p>
              </div>
              <div className="text-right">
                <p className="text-white text-lg font-black">{account.xp.toLocaleString()}</p>
                <p className="text-blue-300 text-xs">Total XP</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-blue-300 mb-0.5">
                <span>XP to Lv.{account.level + 1}</span>
                <span>{account.xpInLevel}/{account.xpNeeded}</span>
              </div>
              <XPBar xpInLevel={account.xpInLevel} xpNeeded={account.xpNeeded} />
              <div className="flex items-center justify-between text-xs text-blue-300 mt-1 mb-0.5">
                <span>Health ❤️</span>
                <span>{account.health}/100</span>
              </div>
              <HealthBar health={account.health} />
            </div>
          </div>

          {/* Time In/Out Button */}
          <div className="space-y-2">
            {!activeSession ? (
              <>
                <div className="flex gap-2">
                  <button onClick={handleTimeIn} disabled={sessionLoading} className="flex-1 py-4 rounded-2xl bg-green-400 hover:bg-green-300 text-green-900 font-black text-base transition-all shadow-lg shadow-green-400/30 active:scale-95 disabled:opacity-50">
                    {sessionLoading ? '⏳ Please wait…' : '▶ TIME IN'}
                  </button>
                  <a href="/intern/qr-checkin-redirect" onClick={async e => {
                    e.preventDefault()
                    const r = await fetch('/api/qr/daily')
                    if (!r.ok) { window.location.href = '/intern/qr-checkin?token=invalid'; return }
                    const d = await r.json()
                    window.location.href = `/intern/qr-checkin?token=${d.token}`
                  }} className="px-4 py-4 rounded-2xl bg-blue-500/20 hover:bg-blue-500/30 border-2 border-blue-400/30 text-white font-bold text-sm transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5">
                    <span className="text-xl">📱</span>
                    <span className="text-[10px] leading-none">QR</span>
                  </a>
                </div>
                <p className="text-center text-blue-300/50 text-[10px]">Or scan the DTC QR display with your phone for GPS-verified check-in</p>
              </>
            ) : (
              <div className="flex gap-2">
                <div className="flex-1 py-3 rounded-2xl bg-blue-400/20 border-2 border-blue-400/40 text-center">
                  <p className="text-white text-xs font-medium mb-0.5">Active Session</p>
                  <p className="text-white font-black text-xl tabular-nums">{fmtElapsed(elapsed)}</p>
                </div>
                <button onClick={() => setShowTimeout(true)} disabled={sessionLoading} className="px-5 rounded-2xl bg-orange-500 hover:bg-orange-400 text-white font-bold text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50">
                  ■ TIME<br/>OUT
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-lg mx-auto px-4">
          <div className="flex border-b border-white/10">
            {(['today', 'tasks', 'progress', 'leaderboard'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-xs font-bold capitalize transition-colors ${tab === t ? 'text-white border-b-2 border-amber-400' : 'text-blue-300 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* Announcements strip */}
        {announcements.length > 0 && (
          <div className="space-y-2">
            {announcements.map(ann => (
              <div key={ann.id} className={`rounded-xl px-4 py-2.5 text-xs font-medium flex items-start gap-2 ${ann.type === 'WARNING' ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-blue-50 border border-blue-200 text-blue-800'}`}>
                <span>{ann.type === 'WARNING' ? '⚠️' : 'ℹ️'}</span>
                <span><strong>{ann.title}:</strong> {ann.body}</span>
              </div>
            ))}
          </div>
        )}

        {/* TODAY Tab */}
        {tab === 'today' && (
          <div className="space-y-4">
            {/* Hours progress */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-gray-700 text-sm">OJT Hours Progress</p>
                <span className="text-xs text-gray-400">{hoursPct}%</span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <p className="text-2xl font-black text-[#0038A8]">{intern.totalHoursLogged.toFixed(1)}</p>
                <div>
                  <p className="text-xs text-gray-400">of {intern.requiredHours}h required</p>
                  <p className="text-xs text-gray-400">{hoursLeft.toFixed(1)}h remaining</p>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#0038A8] to-blue-400 rounded-full transition-all duration-700" style={{ width: `${hoursPct}%` }} />
              </div>
            </div>

            {/* Session History — grouped by day */}
            {(() => {
              const allS = activeSession
                ? [{ id: activeSession.id, timeIn: activeSession.timeIn, timeOut: null, hoursLogged: null, status: 'ACTIVE', progressNote: null, checkInMethod: 'direct' }, ...recentSessions]
                : recentSessions
              // Group by date (YYYY-MM-DD)
              const byDay = new Map<string, SessionRecord[]>()
              allS.forEach(s => {
                const day = s.timeIn.slice(0, 10)
                if (!byDay.has(day)) byDay.set(day, [])
                byDay.get(day)!.push(s)
              })
              const days = Array.from(byDay.entries()).slice(0, 7)
              if (days.length === 0) return null
              const methodIcon = (m: string) => m === 'qr_location' ? '📍' : m === 'qr' ? '📱' : '🖐'
              return (
                <div>
                  <p className="font-bold text-gray-700 text-sm mb-2">🕐 Session History</p>
                  <div className="space-y-2">
                    {days.map(([day, sessions]) => {
                      const closed = sessions.filter(s => s.status === 'CLOSED')
                      const active = sessions.find(s => s.status === 'ACTIVE')
                      const totalH = closed.reduce((sum, s) => sum + (s.hoursLogged ?? 0), 0)
                      const isCombined = sessions.length > 1
                      const firstIn = sessions.reduce((min, s) => s.timeIn < min ? s.timeIn : min, sessions[0].timeIn)
                      const lastOut = closed.length > 0 ? closed.reduce((max, s) => (s.timeOut ?? '') > max ? (s.timeOut ?? '') : max, '') : null
                      const methods = [...new Set(sessions.map(s => s.checkInMethod))]
                      return (
                        <div key={day} className={`rounded-2xl border-2 p-3.5 ${
                          active ? 'border-green-300 bg-green-50' : 'border-gray-100 bg-white'
                        }`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-sm text-gray-800">
                                  {new Date(day).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </p>
                                {isCombined && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                                    ⊕ {sessions.length} sessions combined
                                  </span>
                                )}
                                {active && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                <span>In: {new Date(firstIn).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                {lastOut && <span>Out: {new Date(lastOut).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>}
                                {methods.map(m => <span key={m} title={m}>{methodIcon(m)}</span>)}
                              </div>
                              {isCombined && (
                                <div className="mt-2 space-y-1">
                                  {sessions.map((s, i) => (
                                    <div key={s.id} className="flex items-center gap-2 text-[11px] text-gray-500 pl-2 border-l-2 border-indigo-200">
                                      <span className="font-semibold text-indigo-500">#{i + 1}</span>
                                      <span>{new Date(s.timeIn).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                      {s.timeOut && <span>→ {new Date(s.timeOut).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>}
                                      {s.hoursLogged && <span className="font-bold text-blue-600">{s.hoursLogged}h</span>}
                                      <span title={s.checkInMethod}>{methodIcon(s.checkInMethod)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              {(totalH > 0 || active) && (
                                <p className="font-black text-lg text-[#0038A8]">
                                  {active && closed.length === 0 ? '…' : `${totalH.toFixed(1)}h`}
                                </p>
                              )}
                              {isCombined && totalH > 0 && <p className="text-[9px] text-indigo-500 font-semibold">total</p>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Today's tasks */}
            <div>
              <p className="font-bold text-gray-700 text-sm mb-2">📋 Today&apos;s Tasks ({todayTasks.length})</p>
              {todayTasks.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                  <p className="text-3xl mb-2">✅</p>
                  <p className="text-sm text-gray-500 font-medium">All tasks done for today!</p>
                  <p className="text-xs text-gray-400 mt-1">Great work, keep it up.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayTasks.slice(0, 5).map(task => (
                    <TaskCard key={task.id} task={task} onStatusChange={handleTaskStatus} loading={taskLoading} />
                  ))}
                  {todayTasks.length > 5 && (
                    <button onClick={() => setTab('tasks')} className="w-full py-2 text-sm text-blue-600 font-medium hover:text-blue-800">
                      View all {todayTasks.length} tasks →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TASKS Tab */}
        {tab === 'tasks' && (
          <div className="space-y-4">
            {/* Kanban pills */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'To Do', count: pendingTasks.length, color: 'bg-gray-100 text-gray-600' },
                { label: 'Doing', count: inProgress.length,   color: 'bg-blue-100 text-blue-700' },
                { label: 'Done',  count: doneTasks.length,    color: 'bg-green-100 text-green-700' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl p-3 ${s.color}`}>
                  <p className="text-xl font-black">{s.count}</p>
                  <p className="text-xs font-medium">{s.label}</p>
                </div>
              ))}
            </div>

            {inProgress.length > 0 && (
              <div>
                <p className="font-bold text-blue-700 text-sm mb-2">🔵 In Progress</p>
                <div className="space-y-2">{inProgress.map(t => <TaskCard key={t.id} task={t} onStatusChange={handleTaskStatus} loading={taskLoading} />)}</div>
              </div>
            )}
            {pendingTasks.length > 0 && (
              <div>
                <p className="font-bold text-gray-600 text-sm mb-2">⬜ To Do</p>
                <div className="space-y-2">{pendingTasks.map(t => <TaskCard key={t.id} task={t} onStatusChange={handleTaskStatus} loading={taskLoading} />)}</div>
              </div>
            )}
            {doneTasks.length > 0 && (
              <div>
                <p className="font-bold text-green-700 text-sm mb-2">✅ Completed ({doneTasks.length})</p>
                <div className="space-y-2">{doneTasks.slice(0, 5).map(t => <TaskCard key={t.id} task={t} onStatusChange={handleTaskStatus} loading={taskLoading} />)}</div>
              </div>
            )}
            {tasks.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm">No tasks assigned yet.</p>
                <p className="text-xs mt-1">Your supervisor will assign tasks soon.</p>
              </div>
            )}
          </div>
        )}

        {/* PROGRESS Tab */}
        {tab === 'progress' && (
          <div className="space-y-4">
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Level',    value: `Lv. ${account.level}`,           sub: levelTitle(account.level),          icon: '⚡', bg: 'bg-amber-50 border-amber-200' },
                { label: 'Total XP', value: account.xp.toLocaleString(),      sub: `${account.xpInLevel}/${account.xpNeeded} to next`, icon: '🌟', bg: 'bg-blue-50 border-blue-200' },
                { label: 'Streak',   value: `${account.streak} days`,          sub: account.streak >= 7 ? '🔥 On fire!' : 'Keep it up',  icon: '🔥', bg: 'bg-orange-50 border-orange-200' },
                { label: 'Health',   value: `${account.health}/100`,           sub: account.health > 60 ? '💪 Great' : '⚠️ Low', icon: '❤️', bg: 'bg-rose-50 border-rose-200' },
                { label: 'Hours',    value: `${intern.totalHoursLogged.toFixed(0)}h`, sub: `${hoursLeft.toFixed(0)}h remaining`, icon: '⏱️', bg: 'bg-green-50 border-green-200' },
                { label: 'Tasks Done', value: String(doneTasks.length),        sub: `of ${tasks.length} total`,          icon: '✅', bg: 'bg-teal-50 border-teal-200' },
              ].map(s => (
                <div key={s.label} className={`rounded-2xl border-2 p-3 ${s.bg}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span>{s.icon}</span>
                    <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                  </div>
                  <p className="text-lg font-black text-gray-800">{s.value}</p>
                  <p className="text-xs text-gray-400">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Achievements */}
            <div>
              <p className="font-bold text-gray-700 text-sm mb-3">🏆 Achievements ({account.achievements.length})</p>
              {account.achievements.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
                  <p className="text-gray-400 text-sm">No achievements yet.</p>
                  <p className="text-gray-300 text-xs mt-1">Complete tasks and log hours to unlock badges.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {account.achievements.map(b => <AchievementBadge key={b} badge={b} />)}
                </div>
              )}
            </div>

            <button
              onClick={async () => { await fetch('/api/intern-auth/signout', { method: 'POST' }); router.push('/intern/login') }}
              className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-500 font-semibold text-sm hover:bg-red-50 transition-colors mt-4"
            >
              Sign Out
            </button>
          </div>
        )}

        {/* LEADERBOARD Tab */}
        {tab === 'leaderboard' && (
          <div className="space-y-3">
            <p className="font-bold text-gray-700 text-sm">🏆 Batch Leaderboard</p>
            {leaderboard.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-3xl mb-2">🏅</p>
                <p className="text-sm">No ranking data yet.</p>
              </div>
            ) : (
              leaderboard.map((entry, idx) => {
                const isMe = entry.id === account.id
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`
                return (
                  <div key={entry.id} className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${isMe ? 'border-amber-400 bg-amber-50' : 'border-gray-100 bg-white'}`}>
                    <div className="w-8 text-center text-lg font-black">{medal}</div>
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {entry.internPhoto
                        ? <img src={entry.internPhoto} alt="" className="w-full h-full object-cover" />
                        : <span className="text-sm font-bold text-gray-500">{entry.internName?.[0] ?? '?'}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm truncate ${isMe ? 'text-amber-800' : 'text-gray-800'}`}>
                        {entry.internName} {isMe && <span className="text-amber-600 font-normal">(you)</span>}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <LevelBadge level={entry.level} size="sm" />
                        <span className="text-xs text-amber-600 font-bold">{entry.xp.toLocaleString()} XP</span>
                        {entry.streak > 0 && <span className="text-xs text-orange-500">🔥{entry.streak}</span>}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
