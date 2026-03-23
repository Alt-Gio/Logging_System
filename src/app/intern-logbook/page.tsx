'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────
type Intern = {
  id: string; fullName: string; school: string; course: string
  department: string | null; supervisor: string | null
  status: string; totalHours: number; requiredHours: number
  photoUrl: string | null; email: string | null; phone: string | null
  startDate: string; endDate: string
  attendance: AttendanceRecord[]; tasks: InternTask[]
}
type AttendanceRecord = {
  id: string; date: string; timeIn: string | null
  timeOut: string | null; hours: number | null; status: string
}
type InternTask = {
  id: string; title: string; description: string | null
  status: string; priority: string; dueDate: string | null
}
type ClockEntry = { internId: string; startTime: string }
type AddInternForm = {
  fullName: string; school: string; course: string; department: string
  supervisor: string; email: string; phone: string
  startDate: string; endDate: string; requiredHours: string
}

// ── Helpers ───────────────────────────────────────────────────────────────
const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
}
const fmtTime  = (iso: string) => new Date(iso).toLocaleTimeString('en-PH',{ hour:'numeric', minute:'2-digit', hour12:true })
const fmtDate  = (iso: string) => new Date(iso).toLocaleDateString('en-PH',{ weekday:'short', month:'short', day:'numeric' })
const initials = (n: string)   => n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)
const COLORS   = ['bg-blue-500','bg-violet-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-cyan-500','bg-indigo-500']
const colorFor = (n: string)   => COLORS[n.charCodeAt(0) % COLORS.length]
const EMPTY_FORM: AddInternForm = {
  fullName:'', school:'', course:'', department:'', supervisor:'',
  email:'', phone:'', startDate: new Date().toISOString().slice(0,10), endDate:'', requiredHours:'486',
}

// ── Small Components ──────────────────────────────────────────────────────
function Avatar({ name, photo, size='md' }: { name:string; photo?:string|null; size?:'sm'|'md'|'lg' }) {
  const sz = { sm:'w-8 h-8 text-xs', md:'w-10 h-10 text-sm', lg:'w-14 h-14 text-lg' }[size]
  if (photo) return <img src={photo} className={`${sz} rounded-xl object-cover flex-shrink-0`} alt={name} />
  return <div className={`${sz} ${colorFor(name)} rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0`}>{initials(name)}</div>
}

function Skeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-gray-200 flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-gray-200 rounded-full w-3/4" />
        <div className="h-2.5 bg-gray-200 rounded-full w-1/2" />
      </div>
    </div>
  )
}

function Ring({ pct }: { pct:number }) {
  const r = 22, c = 2 * Math.PI * r
  const col = pct>=100 ? '#10b981' : pct>=70 ? '#3b82f6' : pct>=40 ? '#f59e0b' : '#ef4444'
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="flex-shrink-0">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#e5e7eb" strokeWidth="5"/>
      <circle cx="28" cy="28" r={r} fill="none" stroke={col} strokeWidth="5"
        strokeDasharray={c} strokeDashoffset={c-(Math.min(pct,100)/100)*c}
        strokeLinecap="round" transform="rotate(-90 28 28)" style={{transition:'stroke-dashoffset .5s'}}/>
      <text x="28" y="28" textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="800" fill={col}>{pct}%</text>
    </svg>
  )
}

// ── Add Intern Modal ──────────────────────────────────────────────────────
function AddInternModal({ onClose, onSave }: { onClose:()=>void; onSave:(f:AddInternForm)=>Promise<void> }) {
  const [form, setForm] = useState<AddInternForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof AddInternForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!form.fullName||!form.school||!form.course||!form.startDate||!form.endDate) return
    setSaving(true); await onSave(form); setSaving(false)
  }
  const field = (label:string, k:keyof AddInternForm, placeholder:string, type='text', required=false) => (
    <div>
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">{label}{required && ' *'}</label>
      <input value={form[k]} onChange={set(k)} type={type} required={required} placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
    </div>
  )
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-black text-gray-900">Register New Intern</h2>
          <p className="text-xs text-gray-400 mt-0.5">Intern information will be saved and synced to Google Sheets</p>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {field('Full Name','fullName','e.g. Maria Santos','text',true)}
          <div className="grid grid-cols-2 gap-3">
            {field('School','school','Bicol University','text',true)}
            {field('Course','course','BS Information Technology','text',true)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('Department','department','IT Department')}
            {field('Project Coordinator','supervisor','Supervisor / Coordinator name')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('Email','email','email@school.edu.ph','email')}
            {field('Phone','phone','09XXXXXXXXX')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('Start Date','startDate','','date',true)}
            {field('End Date','endDate','','date',true)}
          </div>
          {field('Required Hours','requiredHours','486 (standard OJT)')}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-bold text-white disabled:opacity-60">
              {saving ? 'Saving...' : 'Register Intern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function InternLogbookPage() {
  // Access gate
  const [access, setAccess]         = useState(false)
  const [codeInput, setCodeInput]   = useState('')
  const [codeError, setCodeError]   = useState('')
  const [checking, setChecking]     = useState(false)

  // Core data
  const [interns, setInterns]       = useState<Intern[]>([])
  const [loading, setLoading]       = useState(true)
  const [view, setView]             = useState<'dashboard'|'interns'|'track'|'attendance'|'tasks'>('dashboard')
  const [selected, setSelected]     = useState<Intern|null>(null)
  const [tasks, setTasks]           = useState<InternTask[]>([])

  // Clock state
  const [clocks, setClocks]         = useState<Record<string,ClockEntry>>({})
  const [elapsed, setElapsed]       = useState<Record<string,number>>({})
  const [tick, setTick]             = useState(0)

  // UI
  const [saving, setSaving]         = useState(false)
  const [confirmOut, setConfirmOut] = useState<Intern|null>(null)
  const [toast, setToast]           = useState<{msg:string;ok:boolean}|null>(null)
  const [showAdd, setShowAdd]       = useState(false)
  const [search, setSearch]         = useState('')
  const [sideOpen, setSideOpen]     = useState(false)
  const [newTask, setNewTask]       = useState('')

  const showToast = (msg:string, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3500) }

  // ── Boot ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (localStorage.getItem('dtc_intern_access_v2') === 'granted') setAccess(true)
    try { const c = localStorage.getItem('dtc_intern_clocks'); if (c) setClocks(JSON.parse(c)) } catch {}
  }, [])

  const verifyCode = async () => {
    if (!codeInput) return
    setChecking(true); setCodeError('')
    try {
      const r = await fetch('/api/settings'); const s = await r.json()
      if (codeInput === (s.accessCode || '2026')) {
        localStorage.setItem('dtc_intern_access_v2','granted'); setAccess(true)
      } else { setCodeError('Incorrect access code. Try again.') }
    } catch { setCodeError('Unable to verify. Check your connection.') }
    setChecking(false)
  }

  // ── Data ─────────────────────────────────────────────────────────────
  const fetchInterns = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/interns'); const d = await r.json()
      if (Array.isArray(d)) setInterns(d)
      else console.error('[InternLogbook] Unexpected response:', d)
    } catch(e) { console.error('[InternLogbook] Fetch error:', e) }
    finally { setLoading(false) }
  }, [])

  const fetchTasks = async (id:string) => {
    try { const r = await fetch(`/api/interns/${id}/tasks`); const d = await r.json(); if(Array.isArray(d)) setTasks(d) } catch {}
  }

  useEffect(() => { if (access) fetchInterns() }, [access, fetchInterns])

  // ── Timers ─────────────────────────────────────────────────────────
  useEffect(() => { const t = setInterval(()=>setTick(n=>n+1),1000); return ()=>clearInterval(t) }, [])
  useEffect(() => {
    const now = Date.now(); const e: Record<string,number> = {}
    for (const [id,entry] of Object.entries(clocks)) e[id] = now - new Date(entry.startTime).getTime()
    setElapsed(e)
  }, [tick, clocks])
  useEffect(() => { try { localStorage.setItem('dtc_intern_clocks',JSON.stringify(clocks)) } catch {} }, [clocks])

  // ── Time In/Out ───────────────────────────────────────────────────
  const handleTimeIn = (intern:Intern) => {
    const startTime = new Date().toISOString()
    setClocks(p=>({...p,[intern.id]:{internId:intern.id,startTime}}))
    showToast(`${intern.fullName.split(' ')[0]} timed in at ${fmtTime(startTime)}`)
  }

  const handleTimeOutConfirmed = async (intern:Intern) => {
    const entry = clocks[intern.id]; if(!entry) return
    setSaving(true)
    try {
      const timeOut = new Date().toISOString(), timeIn = entry.startTime
      const hours = Math.round(((new Date(timeOut).getTime()-new Date(timeIn).getTime())/3600000)*100)/100
      const today = new Date().toISOString().slice(0,10)
      await fetch(`/api/interns/${intern.id}/attendance`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({date:today,timeIn,timeOut,hours,status:'PRESENT'}),
      })
      fetch('/api/sheets/interns',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({type:'attendance',data:{internName:intern.fullName,school:intern.school,date:today,timeIn,timeOut,hours}}),
      }).catch(()=>{})
      const updated = {...clocks}; delete updated[intern.id]; setClocks(updated)
      showToast(`${intern.fullName.split(' ')[0]} timed out — ${hours}h logged`)
      await fetchInterns()
    } catch { showToast('Failed to save. Try again.', false) }
    setSaving(false); setConfirmOut(null)
  }

  // ── Add Intern ────────────────────────────────────────────────────
  const handleAddIntern = async (form:AddInternForm) => {
    try {
      const r = await fetch('/api/interns',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({...form, requiredHours: parseInt(form.requiredHours)||486}),
      })
      if (!r.ok) throw new Error('Failed')
      fetch('/api/sheets/interns',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({type:'intern',data:form}),
      }).catch(()=>{})
      showToast(`${form.fullName} has been registered`); setShowAdd(false); await fetchInterns()
    } catch { showToast('Failed to register intern',false) }
  }

  // ── Tasks ─────────────────────────────────────────────────────────
  const addTask = async () => {
    if (!selected || !newTask.trim()) return
    try {
      await fetch(`/api/interns/${selected.id}/tasks`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({title:newTask.trim(),priority:'MEDIUM'}),
      })
      setNewTask(''); await fetchTasks(selected.id); showToast('Task added')
    } catch { showToast('Failed to add task',false) }
  }
  const toggleTask = async (task:InternTask) => {
    if (!selected) return
    const status = task.status==='COMPLETED' ? 'PENDING' : 'COMPLETED'
    try {
      await fetch(`/api/interns/${selected.id}/tasks`,{
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({taskId:task.id,status}),
      })
      await fetchTasks(selected.id)
    } catch {}
  }

  // ── Computed ──────────────────────────────────────────────────────
  const filtered      = interns.filter(i => i.fullName.toLowerCase().includes(search.toLowerCase())||i.school.toLowerCase().includes(search.toLowerCase()))
  const activeInterns = interns.filter(i => clocks[i.id])
  const todayStr      = new Date().toISOString().slice(0,10)
  const todayLogs     = interns.flatMap(i => i.attendance.filter(a=>a.date.slice(0,10)===todayStr).map(a=>({...a,intern:i})))
  const weekHours     = (() => {
    const now = new Date(); const dow = now.getDay()
    const mon = new Date(now); mon.setDate(now.getDate()-(dow===0?6:dow-1)); mon.setHours(0,0,0,0)
    return interns.reduce((s,i)=>s+i.attendance.filter(a=>new Date(a.date)>=mon).reduce((x,a)=>x+(a.hours??0),0),0)
  })()

  // ── NAV ───────────────────────────────────────────────────────────
  const NAV = [
    { id:'dashboard',  icon:'🏠', label:'Dashboard'  },
    { id:'interns',    icon:'👥', label:'Interns'     },
    { id:'track',      icon:'⏱',  label:'Time Track'  },
    { id:'attendance', icon:'📅', label:'Attendance'  },
    { id:'tasks',      icon:'✅', label:'Tasks'       },
  ] as const

  // ═══════════════════════════════════════════════════════════════════
  // ACCESS GATE
  // ═══════════════════════════════════════════════════════════════════
  if (!access) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl shadow-lg shadow-blue-600/40">🎓</div>
              <h1 className="text-2xl font-black text-white">Intern Attendance</h1>
              <p className="text-blue-300/70 text-sm mt-1.5">DICT Region V &mdash; DTC Legazpi</p>
            </div>
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Access Code</label>
              <input type="password" value={codeInput} onChange={e=>setCodeInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&verifyCode()} placeholder="Enter access code" autoFocus
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {codeError && <p className="text-red-400 text-xs pl-1">{codeError}</p>}
              <button onClick={verifyCode} disabled={checking||!codeInput}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 rounded-xl font-bold text-white text-sm transition-colors">
                {checking ? 'Verifying...' : 'Enter Portal'}
              </button>
            </div>
            <p className="text-center text-gray-600 text-xs mt-6">Contact admin if you need an access code</p>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAIN LAYOUT
  // ═══════════════════════════════════════════════════════════════════
  return (
    <>
      <style>{`
        @keyframes fu{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .fu{animation:fu .25s ease both}
        @keyframes sIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
        .s-in{animation:sIn .2s ease both}
      `}</style>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl shadow-2xl text-white text-sm font-semibold flex items-center gap-2.5 ${toast.ok?'bg-emerald-600':'bg-red-600'}`}>
          {toast.ok?'✓':'✕'} {toast.msg}
        </div>
      )}

      <div className="min-h-[100dvh] bg-gray-50 flex" style={{paddingBottom:'env(safe-area-inset-bottom,0px)'}}>

        {/* ══ SIDEBAR ══════════════════════════════════════════════════════ */}
        {sideOpen && <div className="md:hidden fixed inset-0 bg-black/50 z-30" onClick={()=>setSideOpen(false)} />}
        <aside className={`fixed md:static inset-y-0 left-0 z-40 w-60 bg-slate-900 flex flex-col transform transition-transform duration-200 md:translate-x-0 ${sideOpen?'translate-x-0':'-translate-x-full md:translate-x-0'}`}>
          {/* Logo */}
          <div className="p-5 border-b border-white/8">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-[11px] font-black text-white shadow-lg">DTC</div>
              <div>
                <p className="text-white font-black text-sm leading-none">Intern Portal</p>
                <p className="text-gray-500 text-[10px] mt-0.5">DICT Region V</p>
              </div>
            </div>
          </div>
          {/* Nav */}
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {NAV.map(n=>(
              <button key={n.id} onClick={()=>{setView(n.id);setSideOpen(false)}}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left
                  ${view===n.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400 hover:text-white hover:bg-white/8'}`}>
                <span className="text-base leading-none">{n.icon}</span>
                {n.label}
                {n.id==='track' && activeInterns.length>0 && (
                  <span className="ml-auto bg-emerald-500 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center">{activeInterns.length}</span>
                )}
              </button>
            ))}
          </nav>
          {/* Footer */}
          <div className="p-3 border-t border-white/8 space-y-0.5">
            <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/8 text-xs font-semibold transition-colors">
              <span>←</span> Back to Home
            </Link>
            <button onClick={()=>{localStorage.removeItem('dtc_intern_access_v2');setAccess(false)}}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-500/10 text-xs font-semibold transition-colors">
              <span>🔒</span> Lock Portal
            </button>
          </div>
        </aside>

        {/* ══ MAIN AREA ════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Top bar */}
          <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200 px-4 sm:px-6 h-14 flex items-center justify-between gap-3"
            style={{paddingTop:'env(safe-area-inset-top,0px)'}}>
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={()=>setSideOpen(true)} className="md:hidden p-2 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 text-lg">☰</button>
              <div className="min-w-0">
                <h1 className="font-black text-gray-900 text-sm leading-tight">
                  {{dashboard:'Dashboard',interns:'Interns',track:'Time Track',attendance:'Attendance',tasks:'Tasks'}[view]}
                </h1>
                <p className="text-gray-400 text-[10px] truncate">{new Date().toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {view==='interns' && (
                <button onClick={()=>setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-white text-xs font-bold transition-colors">
                  <span>+</span> Add Intern
                </button>
              )}
              <button onClick={fetchInterns} title="Refresh" className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors font-bold">↻</button>
            </div>
          </header>

          {/* ── Content ──────────────────────────────────────────────────── */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-6xl w-full mx-auto">

            {/* ════ DASHBOARD ════════════════════════════════════════════ */}
            {view==='dashboard' && (
              <div className="space-y-5 fu">
                {/* Stats grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {([
                    {label:'Total Interns',   val:interns.length,               icon:'👥', bg:'bg-blue-50',    text:'text-blue-700',   sub:'text-blue-500'  },
                    {label:'Active Now',       val:activeInterns.length,         icon:'🟢', bg:'bg-emerald-50', text:'text-emerald-700', sub:'text-emerald-500'},
                    {label:'Hours This Week',  val:`${Math.round(weekHours)}h`,  icon:'⏱',  bg:'bg-violet-50',  text:'text-violet-700',  sub:'text-violet-500' },
                    {label:'Present Today',    val:todayLogs.length,             icon:'📅', bg:'bg-amber-50',   text:'text-amber-700',   sub:'text-amber-500'  },
                  ] as {label:string;val:string|number;icon:string;bg:string;text:string;sub:string}[]).map(s=>(
                    <div key={s.label} className={`${s.bg} rounded-2xl p-4 border border-transparent`}>
                      <span className="text-xl">{s.icon}</span>
                      <div className={`text-2xl sm:text-3xl font-black mt-2 ${s.text}`}>{s.val}</div>
                      <div className={`text-xs mt-0.5 font-semibold ${s.sub}`}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Active interns strip */}
                {activeInterns.length>0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
                      <h2 className="font-black text-gray-900 text-sm">Currently Clocked In</h2>
                      <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                        <span className="relative flex h-2 w-2"><span className="animate-ping absolute inset-0 rounded-full bg-emerald-400 opacity-75"/><span className="relative rounded-full h-2 w-2 bg-emerald-500 block"/></span>
                        {activeInterns.length} Active
                      </span>
                    </div>
                    {activeInterns.map(i=>(
                      <div key={i.id} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0">
                        <Avatar name={i.fullName} photo={i.photoUrl} size="sm"/>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-sm truncate">{i.fullName}</p>
                          <p className="text-xs text-gray-400 truncate">{i.school}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-emerald-600 font-mono font-bold text-sm">{fmt(elapsed[i.id]||0)}</p>
                          <p className="text-gray-400 text-[10px]">since {fmtTime(clocks[i.id]?.startTime||'')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Today's log */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-gray-50">
                    <h2 className="font-black text-gray-900 text-sm">Today&apos;s Attendance Log</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date().toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric'})}</p>
                  </div>
                  {todayLogs.length===0 ? (
                    <p className="px-5 py-8 text-center text-gray-400 text-sm">No attendance logged today</p>
                  ) : todayLogs.map(a=>(
                    <div key={a.id} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0">
                      <Avatar name={a.intern.fullName} photo={a.intern.photoUrl} size="sm"/>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{a.intern.fullName}</p>
                        <p className="text-xs text-gray-400 truncate">{a.intern.school}</p>
                      </div>
                      <div className="text-right text-xs">
                        <p className="font-semibold text-gray-700">{a.timeIn?fmtTime(a.timeIn):'—'} → {a.timeOut?fmtTime(a.timeOut):<span className="text-emerald-600 font-bold">Active</span>}</p>
                        {a.hours!=null && <p className="text-blue-600 font-bold">{a.hours}h</p>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Interns progress overview */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
                    <h2 className="font-black text-gray-900 text-sm">Intern Progress Overview</h2>
                    <button onClick={()=>setView('interns')} className="text-blue-600 text-xs font-bold hover:underline">View All →</button>
                  </div>
                  {loading ? (
                    <div className="p-4 space-y-2">{[...Array(3)].map((_,i)=><Skeleton key={i}/>)}</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {interns.slice(0,5).map(i=>{
                        const pct = Math.round((i.totalHours/(i.requiredHours||486))*100)
                        return (
                          <div key={i.id} className="flex items-center gap-4 px-5 py-3">
                            <Avatar name={i.fullName} photo={i.photoUrl} size="sm"/>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-900 text-sm truncate">{i.fullName}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-blue-500 transition-all duration-700" style={{width:`${Math.min(pct,100)}%`}}/>
                                </div>
                                <span className="text-[10px] font-bold text-gray-500 flex-shrink-0">{Math.round(i.totalHours)}h</span>
                              </div>
                            </div>
                            <span className={`text-xs font-black ${pct>=100?'text-emerald-600':pct>=70?'text-blue-600':pct>=40?'text-amber-600':'text-red-500'}`}>{pct}%</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════ INTERNS ══════════════════════════════════════════════ */}
            {view==='interns' && (
              <div className="space-y-4 fu">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or school..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"/>
                </div>
                {loading ? (
                  <div className="space-y-2">{[...Array(5)].map((_,i)=><div key={i} className="bg-white rounded-2xl p-4"><Skeleton/></div>)}</div>
                ) : filtered.length===0 ? (
                  <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                    <p className="text-4xl mb-3">👥</p>
                    <p className="text-gray-500 text-sm mb-4">{search?'No interns match your search':'No interns registered yet'}</p>
                    {!search && <button onClick={()=>setShowAdd(true)} className="px-5 py-2.5 bg-blue-600 rounded-xl text-white text-sm font-bold">+ Register First Intern</button>}
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtered.map(intern=>{
                      const pct = Math.round((intern.totalHours/(intern.requiredHours||486))*100)
                      const clocked = !!clocks[intern.id]
                      return (
                        <div key={intern.id} onClick={()=>{setSelected(intern);setView('tasks');fetchTasks(intern.id)}}
                          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="relative">
                              <Avatar name={intern.fullName} photo={intern.photoUrl} size="md"/>
                              {clocked && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"/>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-900 text-sm truncate group-hover:text-blue-700 transition-colors">{intern.fullName}</p>
                              <p className="text-xs text-gray-500 truncate">{intern.school}</p>
                              <p className="text-[11px] text-gray-400 truncate">{intern.course}</p>
                              {intern.supervisor && <p className="text-[10px] text-blue-500 truncate mt-0.5">📋 {intern.supervisor}</p>}
                            </div>
                            <Ring pct={pct}/>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-3 border-t border-gray-50">
                            <span className={`px-2 py-0.5 rounded-full font-bold ${clocked?'bg-emerald-50 text-emerald-700':'bg-gray-100 text-gray-500'}`}>
                              {clocked ? '● Clocked In' : intern.status}
                            </span>
                            <span className="text-gray-400 font-semibold">{Math.round(intern.totalHours)}h / {intern.requiredHours}h</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ════ TIME TRACK ══════════════════════════════════════════ */}
            {view==='track' && (
              <div className="space-y-4 fu">
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search your name to time in or out..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"/>
                </div>
                {loading ? (
                  <div className="space-y-2">{[...Array(5)].map((_,i)=><div key={i} className="bg-white rounded-2xl p-4"><Skeleton/></div>)}</div>
                ) : (
                  <div className="space-y-2">
                    {filtered.map(intern=>{
                      const clocked = !!clocks[intern.id]
                      return (
                        <div key={intern.id} className={`bg-white rounded-2xl border p-4 flex items-center gap-4 transition-all ${clocked?'border-emerald-200 shadow-md shadow-emerald-50':'border-gray-100'}`}>
                          <Avatar name={intern.fullName} photo={intern.photoUrl} size="md"/>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900">{intern.fullName}</p>
                            <p className="text-xs text-gray-500 truncate">{intern.school}</p>
                            {clocked && <p className="text-emerald-600 font-mono font-bold text-sm mt-0.5">{fmt(elapsed[intern.id]||0)}</p>}
                          </div>
                          {clocked ? (
                            <button onClick={()=>setConfirmOut(intern)} disabled={saving}
                              className="px-4 py-2.5 bg-red-500 hover:bg-red-600 active:bg-red-700 rounded-xl text-white text-sm font-bold transition-colors">
                              Time Out
                            </button>
                          ) : (
                            <button onClick={()=>handleTimeIn(intern)}
                              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 rounded-xl text-white text-sm font-bold transition-colors">
                              Time In
                            </button>
                          )}
                        </div>
                      )
                    })}
                    {filtered.length===0 && <p className="text-center py-12 text-gray-400 text-sm">No results. Try a different name.</p>}
                  </div>
                )}
              </div>
            )}

            {/* ════ ATTENDANCE ══════════════════════════════════════════ */}
            {view==='attendance' && (
              <div className="space-y-4 fu">
                {/* Intern picker */}
                <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
                  {interns.map(i=>(
                    <button key={i.id} onClick={()=>setSelected(i)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-all
                        ${selected?.id===i.id?'bg-blue-600 border-blue-600 text-white':'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                      <Avatar name={i.fullName} photo={i.photoUrl} size="sm"/>
                      {i.fullName.split(' ')[0]}
                    </button>
                  ))}
                </div>
                {!selected ? (
                  <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 text-gray-400 text-sm">Select an intern above to view their attendance</div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-3">
                      <Avatar name={selected.fullName} photo={selected.photoUrl} size="md"/>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-900">{selected.fullName}</p>
                        <p className="text-xs text-gray-500">{selected.school} · {selected.course}</p>
                        {selected.supervisor && <p className="text-[11px] text-blue-500 mt-0.5">Coordinator: {selected.supervisor}</p>}
                      </div>
                      <Ring pct={Math.round((selected.totalHours/(selected.requiredHours||486))*100)}/>
                    </div>
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 grid grid-cols-3 gap-4 text-center">
                      <div><p className="text-xl font-black text-blue-600">{Math.round(selected.totalHours)}</p><p className="text-[10px] text-gray-500 font-semibold">Hours Logged</p></div>
                      <div><p className="text-xl font-black text-gray-900">{selected.requiredHours}</p><p className="text-[10px] text-gray-500 font-semibold">Required</p></div>
                      <div><p className="text-xl font-black text-emerald-600">{selected.attendance.filter(a=>a.status==='PRESENT').length}</p><p className="text-[10px] text-gray-500 font-semibold">Days Present</p></div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="bg-gray-50 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                          <th className="px-5 py-3 text-left">Date</th>
                          <th className="px-5 py-3 text-left">Time In</th>
                          <th className="px-5 py-3 text-left">Time Out</th>
                          <th className="px-5 py-3 text-left">Hours</th>
                          <th className="px-5 py-3 text-left">Status</th>
                        </tr></thead>
                        <tbody className="divide-y divide-gray-50">
                          {selected.attendance.length===0 ? (
                            <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No records yet</td></tr>
                          ) : selected.attendance.map(a=>(
                            <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-5 py-3 font-medium text-gray-700 whitespace-nowrap">{fmtDate(a.date)}</td>
                              <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{a.timeIn?fmtTime(a.timeIn):'—'}</td>
                              <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{a.timeOut?fmtTime(a.timeOut):<span className="text-emerald-600 font-semibold">Active</span>}</td>
                              <td className="px-5 py-3 font-bold text-blue-600 whitespace-nowrap">{a.hours!=null?`${a.hours}h`:'—'}</td>
                              <td className="px-5 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold
                                  ${a.status==='PRESENT'?'bg-emerald-50 text-emerald-700':a.status==='ABSENT'?'bg-red-50 text-red-600':'bg-amber-50 text-amber-700'}`}>
                                  {a.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ════ TASKS ════════════════════════════════════════════════ */}
            {view==='tasks' && (
              <div className="space-y-4 fu">
                {/* Intern picker */}
                <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
                  {interns.map(i=>(
                    <button key={i.id} onClick={()=>{setSelected(i);fetchTasks(i.id)}}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-all
                        ${selected?.id===i.id?'bg-blue-600 border-blue-600 text-white':'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                      <Avatar name={i.fullName} photo={i.photoUrl} size="sm"/>
                      {i.fullName.split(' ')[0]}
                    </button>
                  ))}
                </div>
                {!selected ? (
                  <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 text-gray-400 text-sm">Select an intern above to view their task list</div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-3">
                      <Avatar name={selected.fullName} photo={selected.photoUrl} size="md"/>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-900">{selected.fullName}</p>
                        <p className="text-xs text-gray-500">{selected.course}</p>
                      </div>
                      <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                        {tasks.filter(t=>t.status==='COMPLETED').length}/{tasks.length} done
                      </span>
                    </div>
                    {/* Add task */}
                    <div className="px-5 py-3 border-b border-gray-100 flex gap-2">
                      <input value={newTask} onChange={e=>setNewTask(e.target.value)}
                        onKeyDown={e=>e.key==='Enter'&&addTask()}
                        placeholder="Type a task and press Enter..."
                        className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                      <button onClick={addTask} disabled={!newTask.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl text-white text-sm font-bold transition-colors">Add</button>
                    </div>
                    {/* Task list */}
                    {tasks.length===0 ? (
                      <p className="px-5 py-10 text-center text-gray-400 text-sm">No tasks yet. Add one above!</p>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {/* Pending first */}
                        {[...tasks].sort((a,b)=>a.status==='COMPLETED'?1:b.status==='COMPLETED'?-1:0).map(task=>(
                          <div key={task.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors" onClick={()=>toggleTask(task)}>
                            <div className={`mt-0.5 w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all
                              ${task.status==='COMPLETED'?'bg-emerald-500 border-emerald-500':'border-gray-300 hover:border-blue-400'}`}>
                              {task.status==='COMPLETED' && <span className="text-white text-[10px] font-black">✓</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold transition-colors ${task.status==='COMPLETED'?'line-through text-gray-400':'text-gray-900'}`}>{task.title}</p>
                              {task.description && <p className="text-xs text-gray-400 mt-0.5">{task.description}</p>}
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0
                              ${task.priority==='HIGH'?'bg-red-50 text-red-600':task.priority==='MEDIUM'?'bg-amber-50 text-amber-600':'bg-gray-100 text-gray-500'}`}>
                              {task.priority}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </main>
        </div>
      </div>

      {/* ══ MODALS ══════════════════════════════════════════════════════════ */}
      {showAdd && <AddInternModal onClose={()=>setShowAdd(false)} onSave={handleAddIntern}/>}

      {confirmOut && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <p className="text-lg font-black text-gray-900 mb-2">Confirm Time Out</p>
            <p className="text-gray-500 text-sm mb-1">Clock out <span className="font-bold text-gray-800">{confirmOut.fullName}</span>?</p>
            <p className="text-gray-400 text-sm mb-6">This will log <span className="font-bold text-blue-600">{fmt(elapsed[confirmOut.id]||0)}</span> to their attendance record.</p>
            <div className="flex gap-3">
              <button onClick={()=>setConfirmOut(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={()=>handleTimeOutConfirmed(confirmOut)} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-bold text-white disabled:opacity-60">
                {saving ? 'Saving...' : 'Confirm Time Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
