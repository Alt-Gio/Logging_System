'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'

type Task = { id: string; title: string; status: string; priority: string; difficulty: string; xpReward: number; dueDate: string | null; completedAt: string | null }
type Session = { id: string; timeIn: string; timeOut?: string; hoursLogged?: number; progressNote?: string }
type InternDetail = {
  id: string; fullName: string; school: string; course: string; department: string | null; photoUrl: string | null
  totalHoursLogged: number; requiredHours: number; status: string; completedTasks: number
  account: { id: string; level: number; xp: number; health: number; streak: number; achievements: string[] } | null
  tasks: Task[]; recentSessions: Session[]
}

const DIFFICULTY_COLOR: Record<string,string> = { trivial:'text-gray-400',easy:'text-green-500',medium:'text-blue-500',hard:'text-orange-500',epic:'text-purple-600' }
const STATUS_BG: Record<string,string> = { PENDING:'bg-gray-100 text-gray-600',IN_PROGRESS:'bg-blue-100 text-blue-700',COMPLETED:'bg-green-100 text-green-700',CANCELLED:'bg-red-100 text-red-600' }

function HealthBar({ health }: { health: number }) {
  const color = health > 60 ? 'bg-green-500' : health > 30 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${health}%` }} />
    </div>
  )
}

function levelTitle(level: number) {
  if (level >= 21) return 'DICT Legend'
  if (level >= 16) return 'DTC Elite'
  if (level >= 11) return 'ICT Champion'
  if (level >= 6)  return 'Digital Advocate'
  return 'OJT Beginner'
}

const ACHIEVEMENT_ICONS: Record<string, string> = {
  first_timer: '🌟', task_master: '⚡', streak_keeper: '🔥',
  punctual: '⏰', level_5: '📡', level_10: '🏆', level_20: '👑',
}

export default function SupervisorInternDetailPage() {
  const router  = useRouter()
  const params  = useParams()
  const internId = params.id as string

  const [detail,   setDetail]   = useState<InternDetail | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState<'overview' | 'tasks' | 'sessions'>('overview')
  const [toast,    setToast]    = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [awardXp,  setAwardXp]  = useState('')
  const [awardReason, setAwardReason] = useState('')
  const [awarding, setAwarding] = useState(false)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    const sessRes = await fetch('/api/supervisor-auth/session')
    const sess = await sessRes.json()
    if (!sess || sess.role !== 'SUPERVISOR') { router.push('/supervisor/login'); return }

    const res = await fetch(`/api/supervisor/intern/${internId}`)
    if (res.ok) setDetail(await res.json())
    setLoading(false)
  }, [internId, router])

  useEffect(() => { load() }, [load])

  async function handleAwardXp(e: React.FormEvent) {
    e.preventDefault()
    if (!detail?.account || !awardXp || !awardReason) return
    setAwarding(true)
    try {
      const res = await fetch('/api/supervisor/award-xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: detail.account.id, xp: Number(awardXp), reason: awardReason }),
      })
      if (!res.ok) { showToast((await res.json()).error || 'Failed', 'error'); return }
      setAwardXp('')
      setAwardReason('')
      showToast(`+${awardXp} XP awarded!`)
      await load()
    } catch { showToast('Network error', 'error') } finally { setAwarding(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #312e81, #0f0e2a)' }}>
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    )
  }
  if (!detail) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-gray-500 mb-4">Intern not found</p>
        <button onClick={() => router.back()} className="text-indigo-600 underline">Go Back</button>
      </div>
    </div>
  )

  const acc = detail.account
  const hoursPct = Math.min(100, Math.round((detail.totalHoursLogged / detail.requiredHours) * 100))
  const pending    = detail.tasks.filter(t => t.status === 'PENDING').length
  const inProgress = detail.tasks.filter(t => t.status === 'IN_PROGRESS').length
  const done       = detail.tasks.filter(t => t.status === 'COMPLETED').length

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)' }}>
        <div className="max-w-2xl mx-auto px-4 py-5">
          <button onClick={() => router.back()} className="text-indigo-300 hover:text-white text-sm mb-4 flex items-center gap-1">
            ← Back to Dashboard
          </button>

          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/30 overflow-hidden flex items-center justify-center flex-shrink-0">
              {detail.photoUrl
                ? <img src={detail.photoUrl} alt="" className="w-full h-full object-cover" />
                : <span className="text-2xl font-black text-white">{detail.fullName[0]}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-white font-black text-xl">{detail.fullName}</h1>
              <p className="text-indigo-300 text-sm">{detail.course}</p>
              <p className="text-indigo-400 text-xs">{detail.school}</p>
            </div>
            {acc && (
              <div className="text-right">
                <span className="inline-block bg-gradient-to-r from-amber-400 to-yellow-300 text-yellow-900 font-black text-sm px-3 py-1 rounded-full">
                  Lv.{acc.level}
                </span>
                <p className="text-indigo-300 text-xs mt-1">{levelTitle(acc.level)}</p>
              </div>
            )}
          </div>

          {/* Quick stats */}
          {acc && (
            <div className="bg-white/10 border border-white/20 rounded-2xl p-4 mb-5">
              <div className="grid grid-cols-3 gap-3 text-center mb-3">
                <div>
                  <p className="text-white font-black text-lg">{acc.xp.toLocaleString()}</p>
                  <p className="text-indigo-300 text-xs">Total XP</p>
                </div>
                <div>
                  <p className="text-white font-black text-lg">{acc.streak}</p>
                  <p className="text-indigo-300 text-xs">Day Streak 🔥</p>
                </div>
                <div>
                  <p className={`font-black text-lg ${acc.health < 30 ? 'text-red-400' : 'text-white'}`}>{acc.health}/100</p>
                  <p className="text-indigo-300 text-xs">Health ❤️</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-indigo-300 mb-0.5">
                  <span>❤️ Health</span><span>{acc.health}%</span>
                </div>
                <HealthBar health={acc.health} />
              </div>
            </div>
          )}

          {/* Hours */}
          <div className="bg-white/10 border border-white/20 rounded-2xl p-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-indigo-200 text-xs font-medium">OJT Hours Progress</span>
              <span className="text-white text-xs font-bold">{detail.totalHoursLogged.toFixed(1)} / {detail.requiredHours}h ({hoursPct}%)</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full" style={{ width: `${hoursPct}%` }} />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10 mt-4">
            {(['overview', 'tasks', 'sessions'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-xs font-bold capitalize transition-colors ${tab === t ? 'text-white border-b-2 border-amber-400' : 'text-indigo-300 hover:text-white'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'To Do',  value: pending,    bg: 'bg-gray-100  text-gray-700' },
                { label: 'Doing',  value: inProgress, bg: 'bg-blue-100  text-blue-700' },
                { label: 'Done',   value: done,       bg: 'bg-green-100 text-green-700' },
              ].map(s => (
                <div key={s.label} className={`rounded-2xl p-3 text-center ${s.bg}`}>
                  <p className="text-2xl font-black">{s.value}</p>
                  <p className="text-xs font-medium">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Achievements */}
            {acc && acc.achievements.length > 0 && (
              <div>
                <p className="font-bold text-gray-700 text-sm mb-2">🏆 Achievements ({acc.achievements.length})</p>
                <div className="flex flex-wrap gap-2">
                  {acc.achievements.map(b => (
                    <span key={b} className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-2.5 py-1 rounded-full font-medium">
                      {ACHIEVEMENT_ICONS[b] ?? '🎖️'} {b.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Award XP form (supervisor tool) */}
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-4">
              <p className="font-bold text-gray-700 text-sm mb-3">⚡ Award Bonus XP</p>
              <form onSubmit={handleAwardXp} className="space-y-3">
                <div className="flex gap-2">
                  <input type="number" min="1" max="500" placeholder="XP amount" value={awardXp}
                    onChange={e => setAwardXp(e.target.value)}
                    className="w-24 px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none text-sm" />
                  <input type="text" placeholder="Reason (e.g. Extra initiative)" value={awardReason}
                    onChange={e => setAwardReason(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none text-sm" />
                </div>
                <button type="submit" disabled={awarding || !awardXp || !awardReason || !acc}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm disabled:opacity-50">
                  {awarding ? 'Awarding…' : '⚡ Award XP'}
                </button>
              </form>
            </div>
          </>
        )}

        {tab === 'tasks' && (
          <div className="space-y-2">
            {detail.tasks.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-2xl mb-2">📭</p>
                <p className="text-sm">No tasks assigned yet.</p>
              </div>
            ) : (
              detail.tasks.map(task => (
                <div key={task.id} className={`rounded-2xl border-2 p-3 ${task.status === 'COMPLETED' ? 'bg-green-50 border-green-200 opacity-70' : 'bg-white border-gray-100'}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm ${task.status === 'COMPLETED' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs font-bold ${DIFFICULTY_COLOR[task.difficulty] ?? ''}`}>★ {task.difficulty}</span>
                        <span className="text-xs text-amber-600 font-bold">+{task.xpReward} XP</span>
                        {task.dueDate && <span className="text-xs text-gray-400">Due {new Date(task.dueDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${STATUS_BG[task.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {task.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'sessions' && (
          <div className="space-y-2">
            {detail.recentSessions.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-2xl mb-2">📅</p>
                <p className="text-sm">No sessions recorded yet.</p>
              </div>
            ) : (
              detail.recentSessions.map(session => {
                const timeIn   = new Date(session.timeIn)
                const timeOut  = session.timeOut ? new Date(session.timeOut) : null
                return (
                  <div key={session.id} className="bg-white rounded-2xl border-2 border-gray-100 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-gray-800">
                        {timeIn.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      {session.hoursLogged && (
                        <span className="text-xs text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-full">
                          {session.hoursLogged.toFixed(2)}h
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {timeIn.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                      {timeOut ? ` → ${timeOut.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}` : ' → Active'}
                    </p>
                    {session.progressNote && (
                      <p className="text-xs text-gray-500 mt-1.5 italic border-l-2 border-gray-200 pl-2">{session.progressNote}</p>
                    )}
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
