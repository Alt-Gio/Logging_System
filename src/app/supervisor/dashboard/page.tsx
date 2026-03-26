'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type SupervisorSession = { id: string; name: string; email: string; department: string; role: string }
type InternEntry = {
  id: string; fullName: string; school: string; course: string; photoUrl: string | null
  status: string; totalHoursLogged: number; requiredHours: number
  account: { id: string; level: number; xp: number; health: number; streak: number; achievements: string[] } | null
  activeSession: { id: string; timeIn: string } | null
  pendingTasks: number; completedTasks: number; totalTasks: number
}
type Task = { id: string; title: string; status: string; priority: string; difficulty: string; xpReward: number }

function levelTitle(level: number) {
  if (level >= 21) return 'DICT Legend'
  if (level >= 16) return 'DTC Elite'
  if (level >= 11) return 'ICT Champion'
  if (level >= 6)  return 'Digital Advocate'
  return 'OJT Beginner'
}

function HealthBar({ health }: { health: number }) {
  const color = health > 60 ? 'bg-green-500' : health > 30 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${health}%` }} />
    </div>
  )
}

function XPBar({ xpInLevel, xpNeeded }: { xpInLevel: number; xpNeeded: number }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.round((xpInLevel / xpNeeded) * 100))}%` }} />
    </div>
  )
}

function fmtSessionTime(timeIn: string) {
  const elapsed = Math.floor((Date.now() - new Date(timeIn).getTime()) / 1000)
  const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60)
  return `${h}h ${m}m`
}

export default function SupervisorDashboardPage() {
  const router = useRouter()
  const [session,     setSession]     = useState<SupervisorSession | null>(null)
  const [interns,     setInterns]     = useState<InternEntry[]>([])
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState<'overview' | 'assign' | 'invite'>('overview')
  const [search,      setSearch]      = useState('')
  const [taskForm,    setTaskForm]    = useState({ title: '', description: '', priority: 'MEDIUM', difficulty: 'medium', internId: '', dueDate: '' })
  const [taskLoading, setTaskLoading] = useState(false)
  const [inviteForm,  setInviteForm]  = useState({ internId: '', email: '' })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [toast,       setToast]       = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    const sessRes = await fetch('/api/supervisor-auth/session')
    const sess = await sessRes.json()
    if (!sess || sess.role !== 'SUPERVISOR') { router.push('/supervisor/login'); return }
    setSession(sess)
    const res = await fetch(`/api/supervisor/interns?supervisorId=${sess.id}`)
    if (res.ok) setInterns(await res.json())
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
    const poll = setInterval(load, 30_000)
    return () => clearInterval(poll)
  }, [load])

  async function handleAssignTask(e: React.FormEvent) {
    e.preventDefault()
    if (!taskForm.title.trim()) return
    setTaskLoading(true)
    try {
      const xpMap: Record<string, number> = { trivial: 5, easy: 10, medium: 20, hard: 40, epic: 100 }
      const res = await fetch('/api/supervisor/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...taskForm,
          xpReward: xpMap[taskForm.difficulty] ?? 10,
          internId: taskForm.internId || undefined,
          dueDate:  taskForm.dueDate ? new Date(taskForm.dueDate).getTime() : undefined,
        }),
      })
      if (!res.ok) { showToast((await res.json()).error || 'Failed to assign task', 'error'); return }
      setTaskForm({ title: '', description: '', priority: 'MEDIUM', difficulty: 'medium', internId: '', dueDate: '' })
      showToast('Task assigned!')
      await load()
    } catch { showToast('Network error', 'error') } finally { setTaskLoading(false) }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteForm.internId || !inviteForm.email) return
    setInviteLoading(true)
    try {
      const res = await fetch('/api/intern-auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...inviteForm, supervisorId: session?.id }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Failed to send invite', 'error'); return }
      setInviteForm({ internId: '', email: '' })
      showToast('Invite email sent!')
    } catch { showToast('Network error', 'error') } finally { setInviteLoading(false) }
  }

  const filtered = interns.filter(i => !search || i.fullName.toLowerCase().includes(search.toLowerCase()))
  const clockedIn = interns.filter(i => i.activeSession)
  const lowHealth = interns.filter(i => i.account && i.account.health < 30)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #312e81, #0f0e2a)' }}>
        <div className="text-white text-center">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-indigo-200 text-sm">Loading dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)' }}>
        <div className="max-w-4xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-indigo-300 text-xs font-medium uppercase tracking-wide">Supervisor Portal</p>
              <h1 className="text-white font-black text-2xl">{session?.name}</h1>
              <p className="text-indigo-300 text-sm">{session?.department}</p>
            </div>
            <button
              onClick={async () => { await fetch('/api/supervisor-auth/signout', { method: 'POST' }); router.push('/supervisor/login') }}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition-all"
            >
              Sign Out
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2 mb-5">
            {[
              { label: 'Total Interns', value: interns.length, icon: '👥', color: 'bg-blue-500/20 border-blue-400/30' },
              { label: 'Clocked In',    value: clockedIn.length, icon: '⏱️', color: 'bg-green-500/20 border-green-400/30' },
              { label: 'Low Health',    value: lowHealth.length,  icon: '⚠️', color: 'bg-red-500/20 border-red-400/30' },
              { label: 'Avg Level',
                value: interns.length ? (interns.reduce((s, i) => s + (i.account?.level ?? 1), 0) / interns.length).toFixed(1) : '—',
                icon: '⚡', color: 'bg-amber-500/20 border-amber-400/30' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border p-2.5 text-center ${s.color}`}>
                <p className="text-lg">{s.icon}</p>
                <p className="text-white font-black text-base">{s.value}</p>
                <p className="text-indigo-300 text-[10px] font-medium leading-tight">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10">
            {(['overview', 'assign', 'invite'] as const).map(t => (
              <button
                key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-xs font-bold capitalize transition-colors ${tab === t ? 'text-white border-b-2 border-amber-400' : 'text-indigo-300 hover:text-white'}`}
              >
                {t === 'assign' ? '📋 Assign Task' : t === 'invite' ? '📧 Invite Intern' : '📊 Overview'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">

        {/* OVERVIEW Tab */}
        {tab === 'overview' && (
          <>
            {lowHealth.length > 0 && (
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                <p className="text-red-700 font-bold text-sm mb-2">⚠️ Interns with Low Health</p>
                <div className="flex flex-wrap gap-2">
                  {lowHealth.map(i => (
                    <span key={i.id} className="bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-full font-medium">
                      {i.fullName} — {i.account?.health ?? 0}❤️
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text" placeholder="Search interns…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none text-sm bg-white"
              />
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-3xl mb-2">👥</p>
                <p className="text-sm">No interns yet.</p>
                <button onClick={() => setTab('invite')} className="mt-3 text-indigo-600 text-sm underline">Send an invite</button>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(intern => {
                  const acc = intern.account
                  const xpInLevel = acc ? (() => { let l=1, r=acc.xp; while(r>=l*100){r-=l*100;l++}; return r })() : 0
                  const xpNeeded  = acc ? acc.level * 100 : 100
                  const hoursPct  = Math.min(100, Math.round((intern.totalHoursLogged / intern.requiredHours) * 100))
                  return (
                    <div
                      key={intern.id}
                      onClick={() => router.push(`/supervisor/intern/${intern.id}`)}
                      className="bg-white rounded-2xl border-2 border-gray-100 hover:border-indigo-200 p-4 cursor-pointer transition-all active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {intern.photoUrl
                            ? <img src={intern.photoUrl} alt="" className="w-full h-full object-cover" />
                            : <span className="font-bold text-indigo-600 text-sm">{intern.fullName[0]}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-800 text-sm truncate">{intern.fullName}</p>
                            {intern.activeSession && (
                              <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                                ⏱ {fmtSessionTime(intern.activeSession.timeIn)}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-xs truncate">{intern.school} · {intern.course}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${acc ? `bg-gradient-to-r from-indigo-500 to-purple-500 text-white` : 'bg-gray-100 text-gray-400'}`}>
                            {acc ? `Lv.${acc.level}` : 'No Acct'}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        {acc && (
                          <>
                            <div>
                              <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                                <span>❤️ Health</span><span>{acc.health}/100</span>
                              </div>
                              <HealthBar health={acc.health} />
                            </div>
                            <div>
                              <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                                <span>⚡ XP</span><span>{xpInLevel}/{xpNeeded}</span>
                              </div>
                              <XPBar xpInLevel={xpInLevel} xpNeeded={xpNeeded} />
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>⏱ {intern.totalHoursLogged.toFixed(1)}h/{intern.requiredHours}h ({hoursPct}%)</span>
                        <span>✅ {intern.completedTasks}/{intern.totalTasks} tasks</span>
                        {acc?.streak ? <span>🔥 {acc.streak}-day streak</span> : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ASSIGN TASK Tab */}
        {tab === 'assign' && (
          <form onSubmit={handleAssignTask} className="bg-white rounded-2xl border-2 border-gray-100 p-5 space-y-4">
            <h2 className="font-bold text-gray-800">Assign New Task</h2>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Assign To</label>
              <select value={taskForm.internId} onChange={e => setTaskForm(f => ({ ...f, internId: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none text-sm bg-white">
                <option value="">All Interns</option>
                {interns.map(i => <option key={i.id} value={i.id}>{i.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Task Title *</label>
              <input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                placeholder="E.g. Create a presentation on ICT trends" required
                className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none text-sm bg-white" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Description</label>
              <textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Additional details…" rows={2}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none text-sm bg-white resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Priority</label>
                <select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none text-sm bg-white">
                  {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Difficulty (XP)</label>
                <select value={taskForm.difficulty} onChange={e => setTaskForm(f => ({ ...f, difficulty: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none text-sm bg-white">
                  {[['trivial','Trivial (5 XP)'],['easy','Easy (10 XP)'],['medium','Medium (20 XP)'],['hard','Hard (40 XP)'],['epic','Epic (100 XP)']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Due Date (optional)</label>
              <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none text-sm bg-white" />
            </div>
            <button type="submit" disabled={taskLoading || !taskForm.title.trim()}
              className="w-full py-3 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-sm transition-all disabled:opacity-50">
              {taskLoading ? 'Assigning…' : '📋 Assign Task'}
            </button>
          </form>
        )}

        {/* INVITE Tab */}
        {tab === 'invite' && (
          <form onSubmit={handleInvite} className="bg-white rounded-2xl border-2 border-gray-100 p-5 space-y-4">
            <h2 className="font-bold text-gray-800">Invite Intern to Portal</h2>
            <p className="text-sm text-gray-500">The intern must already be registered in the system. Select their profile and enter their email to send an invite link.</p>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Select Intern</label>
              <select value={inviteForm.internId} onChange={e => setInviteForm(f => ({ ...f, internId: e.target.value }))} required
                className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none text-sm bg-white">
                <option value="">Choose intern…</option>
                {interns.filter(i => !i.account).map(i => <option key={i.id} value={i.id}>{i.fullName}</option>)}
              </select>
              {interns.filter(i => !i.account).length === 0 && (
                <p className="text-xs text-gray-400 mt-1">All interns already have accounts.</p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Email Address</label>
              <input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} required
                placeholder="intern.email@example.com"
                className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none text-sm bg-white" />
            </div>
            <button type="submit" disabled={inviteLoading || !inviteForm.internId || !inviteForm.email}
              className="w-full py-3 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-sm disabled:opacity-50">
              {inviteLoading ? 'Sending…' : '📧 Send Invite Email'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
