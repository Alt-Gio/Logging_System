'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { GovSeal, GovHeaderLogos } from '@/components/GovernmentHeader'

// ── Types ─────────────────────────────────────────────────────────────────
type InternStatus = 'ACTIVE' | 'COMPLETED' | 'INACTIVE' | 'ON_LEAVE'
type Intern = {
  id: string; fullName: string; school: string; course: string
  department: string | null; supervisor: string | null
  status: InternStatus; totalHours: number; requiredHours: number
  photoUrl: string | null; email: string | null; phone: string | null
  startDate: string; endDate: string; notes: string | null
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
type InternSessionRecord = { id: string; internId: string; timeIn: string; status: string }
type AddInternForm = {
  fullName: string; school: string; course: string; department: string
  supervisor: string; email: string; phone: string
  startDate: string; endDate: string; requiredHours: string
}
type NavView = 'overview' | 'interns' | 'track' | 'attendance' | 'tasks'

// ── Design constants ──────────────────────────────────────────────────────
const SCHOOL_PALETTE = [
  { bg:'bg-blue-100',   text:'text-blue-700',   dot:'bg-blue-500',   ring:'ring-blue-200',   grad:'from-blue-500 to-indigo-600',   light:'bg-blue-50',   border:'border-blue-200'   },
  { bg:'bg-purple-100', text:'text-purple-700', dot:'bg-purple-500', ring:'ring-purple-200', grad:'from-purple-500 to-purple-700', light:'bg-purple-50', border:'border-purple-200' },
  { bg:'bg-emerald-100',text:'text-emerald-700',dot:'bg-emerald-500',ring:'ring-emerald-200',grad:'from-emerald-500 to-green-600',  light:'bg-emerald-50',border:'border-emerald-200'},
  { bg:'bg-orange-100', text:'text-orange-700', dot:'bg-orange-500', ring:'ring-orange-200', grad:'from-orange-500 to-amber-500',  light:'bg-orange-50', border:'border-orange-200' },
  { bg:'bg-rose-100',   text:'text-rose-700',   dot:'bg-rose-500',   ring:'ring-rose-200',   grad:'from-rose-500 to-pink-600',    light:'bg-rose-50',   border:'border-rose-200'   },
  { bg:'bg-teal-100',   text:'text-teal-700',   dot:'bg-teal-500',   ring:'ring-teal-200',   grad:'from-teal-500 to-cyan-600',    light:'bg-teal-50',   border:'border-teal-200'   },
  { bg:'bg-indigo-100', text:'text-indigo-700', dot:'bg-indigo-500', ring:'ring-indigo-200', grad:'from-indigo-500 to-blue-600',  light:'bg-indigo-50', border:'border-indigo-200' },
  { bg:'bg-amber-100',  text:'text-amber-700',  dot:'bg-amber-500',  ring:'ring-amber-200',  grad:'from-amber-500 to-yellow-500', light:'bg-amber-50',  border:'border-amber-200'  },
]
function getSchoolColor(school: string) {
  let h = 0
  for (let i = 0; i < school.length; i++) h = (school.charCodeAt(i) + ((h << 5) - h)) | 0
  return SCHOOL_PALETTE[Math.abs(h) % SCHOOL_PALETTE.length]
}

const DEPT_META: { key: string; label: string; short: string; color: string; icon: string }[] = [
  { key:'miss',    label:'Management Information Systems', short:'MIS/S',    color:'bg-sky-100 text-sky-700 border-sky-300',         icon:'🖥️' },
  { key:'cyber',   label:'Cybersecurity',                  short:'Cybersec', color:'bg-red-100 text-red-700 border-red-300',          icon:'🔒' },
  { key:'gdtb',    label:'Geospatial Data & Tech Branch',  short:'GDTB',     color:'bg-green-100 text-green-700 border-green-300',    icon:'🗺️' },
  { key:'imb',     label:'Information Management Branch',  short:'IMB',      color:'bg-purple-100 text-purple-700 border-purple-300', icon:'📊' },
  { key:'graphic', label:'Graphic Design / Multimedia',    short:'Graphic',  color:'bg-pink-100 text-pink-700 border-pink-300',       icon:'🎨' },
  { key:'web',     label:'Web Development',                short:'Web Dev',  color:'bg-indigo-100 text-indigo-700 border-indigo-300', icon:'🌐' },
  { key:'network', label:'Network Engineering',            short:'Network',  color:'bg-orange-100 text-orange-700 border-orange-300', icon:'📡' },
  { key:'database',label:'Database Administration',        short:'DBA',      color:'bg-teal-100 text-teal-700 border-teal-300',       icon:'🗄️' },
]
function getDeptBadge(intern: { department?: string | null; course?: string }) {
  const hay = ((intern.department||'') + ' ' + (intern.course||'')).toLowerCase()
  return DEPT_META.find(d => hay.includes(d.key)) || null
}

const STATUS_META: Record<InternStatus, { label:string; dot:string; badge:string }> = {
  ACTIVE:    { label:'Active',    dot:'bg-green-500',  badge:'bg-green-100 text-green-700 border border-green-300'   },
  COMPLETED: { label:'Completed', dot:'bg-blue-500',   badge:'bg-blue-100 text-blue-700 border border-blue-300'      },
  INACTIVE:  { label:'Inactive',  dot:'bg-gray-400',   badge:'bg-gray-100 text-gray-500 border border-gray-300'      },
  ON_LEAVE:  { label:'On Leave',  dot:'bg-yellow-500', badge:'bg-yellow-100 text-yellow-700 border border-yellow-300'},
}

const PRIORITY_META: Record<string,{label:string;color:string}> = {
  LOW:    { label:'Low',    color:'bg-gray-100 text-gray-600'       },
  MEDIUM: { label:'Medium', color:'bg-yellow-100 text-yellow-700'   },
  HIGH:   { label:'High',   color:'bg-orange-100 text-orange-700'   },
  URGENT: { label:'Urgent', color:'bg-red-100 text-red-700'         },
}

const NAV_ITEMS: { id: NavView; label: string; icon: string; description: string }[] = [
  { id:'overview',    label:'Overview',        icon:'📊', description:'Dashboard & stats'    },
  { id:'interns',     label:'Intern Roster',   icon:'👥', description:'View & manage interns' },
  { id:'track',       label:'Time Track',      icon:'⏱️', description:'Clock in / clock out'  },
  { id:'attendance',  label:'Attendance / DTR',icon:'📅', description:'Time records'          },
  { id:'tasks',       label:'Tasks',           icon:'✅', description:'Assign & track'        },
]

const EMPTY_FORM: AddInternForm = {
  fullName:'', school:'', course:'', department:'', supervisor:'',
  email:'', phone:'', startDate: new Date().toISOString().slice(0,10), endDate:'', requiredHours:'486',
}

// ── Helpers ───────────────────────────────────────────────────────────────
const fmt      = (ms: number) => { const s=Math.floor(ms/1000); return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` }
const fmtTime  = (iso: string) => new Date(iso).toLocaleTimeString('en-PH',{ hour:'numeric', minute:'2-digit', hour12:true })
const fmtDate  = (iso: string) => new Date(iso).toLocaleDateString('en-PH',{ weekday:'short', month:'short', day:'numeric' })

// ── Small Components ──────────────────────────────────────────────────────
function Spinner() {
  return <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/>
}

function Avatar({ name, photo, size='md' }: { name?:string; photo?:string|null; size?:'sm'|'md'|'lg'|'xl' }) {
  const sz = { sm:'w-8 h-8 text-xs', md:'w-10 h-10 text-sm', lg:'w-14 h-14 text-lg', xl:'w-20 h-20 text-2xl' }[size]
  const initials = name?.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase() || '?'
  if (photo) return <img src={photo} className={`${sz} rounded-full object-cover flex-shrink-0 border-2 border-white shadow-sm`} alt={name||''}/>
  return <div className={`${sz} rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm`}>{initials}</div>
}

function HoursProgress({ current, required }: { current:number; required:number }) {
  const pct = Math.min(100, Math.round((current/required)*100))
  const color = pct>=100 ? 'from-green-400 to-emerald-500' : pct>=70 ? 'from-blue-400 to-indigo-500' : pct>=40 ? 'from-yellow-400 to-orange-400' : 'from-red-400 to-rose-500'
  const textColor = pct>=100 ? 'text-green-600' : pct>=70 ? 'text-blue-600' : 'text-orange-600'
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500 font-medium">{Math.round(current)}h / {required}h</span>
        <span className={`text-xs font-bold ${textColor}`}>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full bg-gradient-to-r ${color} transition-all duration-500`} style={{width:`${pct}%`}}/>
      </div>
    </div>
  )
}

// ── Add Intern Modal ──────────────────────────────────────────────────────
function AddInternModal({ onClose, onSave, saving }: { onClose:()=>void; onSave:(f:AddInternForm)=>Promise<void>; saving:boolean }) {
  const [form, setForm] = useState<AddInternForm>(EMPTY_FORM)
  const [photoPreview, setPhotoPreview] = useState<string|null>(null)
  const set = (k: keyof AddInternForm) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader(); reader.onload = () => setPhotoPreview(reader.result as string); reader.readAsDataURL(file)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.fullName||!form.school||!form.course||!form.startDate||!form.endDate) return
    await onSave(form)
  }

  const inputCls = "w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="font-display font-bold text-xl text-gray-800">Register New Intern</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg">✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="p-6 space-y-5">
            {/* Photo */}
            <div className="flex items-center gap-5 p-4 bg-gray-50 rounded-2xl">
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 overflow-hidden flex-shrink-0 flex items-center justify-center bg-white shadow-sm">
                {photoPreview ? <img src={photoPreview} className="w-full h-full object-cover" alt="Preview"/> : <span className="text-3xl">👤</span>}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Intern Photo <span className="text-gray-400 font-normal">(optional)</span></p>
                <label className="cursor-pointer px-4 py-2 border-2 border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:border-[var(--dict-blue)] hover:text-[var(--dict-blue)] transition-all inline-flex items-center gap-2 bg-white">
                  📷 Upload Photo <input type="file" accept="image/*" className="hidden" onChange={handlePhoto}/>
                </label>
                {photoPreview && <button type="button" onClick={()=>setPhotoPreview(null)} className="ml-2 text-xs text-red-400 hover:text-red-600 font-semibold">✕ Remove</button>}
              </div>
            </div>
            {/* Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Full Name *</label>
                <input value={form.fullName} onChange={set('fullName')} required placeholder="e.g. Juan Dela Cruz" className={inputCls}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">School / University *</label>
                <input value={form.school} onChange={set('school')} required placeholder="e.g. Bicol University" className={inputCls}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Course / Program *</label>
                <input value={form.course} onChange={set('course')} required placeholder="e.g. BSIT" className={inputCls}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Department</label>
                <input value={form.department} onChange={set('department')} placeholder="e.g. ICT Division" className={inputCls}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Project Coordinator / Supervisor</label>
                <input value={form.supervisor} onChange={set('supervisor')} placeholder="e.g. John Smith" className={inputCls}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Start Date *</label>
                <input type="date" value={form.startDate} onChange={set('startDate')} required className={inputCls}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">End Date *</label>
                <input type="date" value={form.endDate} onChange={set('endDate')} required className={inputCls}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Required Hours</label>
                <input type="number" value={form.requiredHours} onChange={set('requiredHours')} className={inputCls}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={set('email')} placeholder="intern@email.com" className={inputCls}/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Phone</label>
                <input value={form.phone} onChange={set('phone')} placeholder="09XX-XXX-XXXX" className={inputCls}/>
              </div>
            </div>
          </div>
          <div className="flex gap-3 p-6 border-t border-gray-100">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Spinner/>Saving...</> : '+ Register Intern'}
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
  const [access, setAccess]       = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState('')
  const [checking, setChecking]   = useState(false)

  // Data
  const [interns, setInterns]     = useState<Intern[]>([])
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState<NavView>('overview')
  const [selected, setSelected]   = useState<Intern|null>(null)
  const [tasks, setTasks]         = useState<InternTask[]>([])
  const [search, setSearch]       = useState('')
  const [filterSchool, setFilterSchool] = useState('all')

  // Clock (localStorage fallback + DB sessions)
  const [clocks, setClocks]       = useState<Record<string,ClockEntry>>({})
  const [dbSessions, setDbSessions] = useState<Record<string,InternSessionRecord>>({})
  const [elapsed, setElapsed]     = useState<Record<string,number>>({})
  const [tick, setTick]           = useState(0)

  // UI
  const [saving, setSaving]             = useState(false)
  const [confirmOut, setConfirmOut]     = useState<Intern|null>(null)
  const [progressNote, setProgressNote] = useState('')
  const [toast, setToast]               = useState<{msg:string;ok:boolean}|null>(null)
  const [showAdd, setShowAdd]           = useState(false)
  const [sideOpen, setSideOpen]         = useState(true)
  const [newTask, setNewTask]           = useState('')

  const showToast = (msg:string, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3500) }

  // ── Boot ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (localStorage.getItem('dtc_intern_access_v2') === 'granted') setAccess(true)
    try { const c = localStorage.getItem('dtc_intern_clocks'); if (c) setClocks(JSON.parse(c)) } catch {}
  }, [])

  const fetchActiveSessions = useCallback(async () => {
    try {
      const r = await fetch('/api/intern-sessions')
      const list: InternSessionRecord[] = await r.json()
      if (Array.isArray(list)) {
        const map: Record<string,InternSessionRecord> = {}
        const clockMap: Record<string,ClockEntry> = {}
        list.forEach(s => {
          map[s.internId] = s
          clockMap[s.internId] = { internId: s.internId, startTime: s.timeIn }
        })
        setDbSessions(map)
        setClocks(prev => ({ ...prev, ...clockMap }))
      }
    } catch {}
  }, [])

  const verifyCode = async () => {
    if (!codeInput) return
    setChecking(true); setCodeError('')
    try {
      const r = await fetch('/api/settings'); const s = await r.json()
      if (codeInput === (s.accessCode || '2026')) {
        localStorage.setItem('dtc_intern_access_v2','granted'); setAccess(true)
      } else { setCodeError('Incorrect access code. Please try again.') }
    } catch { setCodeError('Unable to verify. Check your connection.') }
    setChecking(false)
  }

  // ── Fetching ──────────────────────────────────────────────────────
  const fetchInterns = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/interns'); const d = await r.json()
      if (Array.isArray(d)) setInterns(d)
    } catch(e) { console.error('[InternLogbook]', e) }
    finally { setLoading(false) }
  }, [])

  const fetchTasks = async (id:string) => {
    try { const r = await fetch(`/api/interns/${id}/tasks`); const d = await r.json(); if(Array.isArray(d)) setTasks(d) } catch {}
  }

  useEffect(() => { if (access) { fetchInterns(); fetchActiveSessions() } }, [access, fetchInterns, fetchActiveSessions])

  // ── Timers ─────────────────────────────────────────────────────────
  useEffect(() => { const t = setInterval(()=>setTick(n=>n+1),1000); return ()=>clearInterval(t) }, [])
  useEffect(() => {
    const now = Date.now(); const e: Record<string,number> = {}
    for (const [id,entry] of Object.entries(clocks)) e[id] = now - new Date(entry.startTime).getTime()
    setElapsed(e)
  }, [tick, clocks])

  // ── Time In/Out ───────────────────────────────────────────────────
  const handleTimeIn = async (intern:Intern) => {
    try {
      const r = await fetch('/api/intern-sessions', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ internId: intern.id }),
      })
      const session: InternSessionRecord = await r.json()
      setDbSessions(p => ({ ...p, [intern.id]: session }))
      setClocks(p => ({ ...p, [intern.id]: { internId: intern.id, startTime: session.timeIn } }))
      showToast(`${intern.fullName.split(' ')[0]} timed in at ${fmtTime(session.timeIn)}`)
    } catch { showToast('Failed to time in. Check connection.', false) }
  }

  const handleTimeOutConfirmed = async (intern:Intern) => {
    const note = progressNote.trim()
    if (!note) { showToast('Please write a progress note first.', false); return }
    const session = dbSessions[intern.id]
    setSaving(true)
    try {
      if (session) {
        const r = await fetch(`/api/intern-sessions/${session.id}`, {
          method:'PATCH', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ progressNote: note, closedBy: 'manual' }),
        })
        if (!r.ok) throw new Error('Failed')
      } else {
        const entry = clocks[intern.id]; if(!entry) return
        const timeOut = new Date().toISOString(), timeIn = entry.startTime
        const hours = Math.round(((new Date(timeOut).getTime()-new Date(timeIn).getTime())/3600000)*100)/100
        const today = new Date().toISOString().slice(0,10)
        await fetch(`/api/interns/${intern.id}/attendance`,{
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({date:today,timeIn,timeOut,hours,status:'PRESENT',notes:note}),
        })
      }
      const updated = {...clocks}; delete updated[intern.id]; setClocks(updated)
      const updatedSessions = {...dbSessions}; delete updatedSessions[intern.id]; setDbSessions(updatedSessions)
      showToast(`${intern.fullName.split(' ')[0]} timed out — progress saved`)
      setProgressNote('')
      await fetchInterns()
    } catch { showToast('Failed to save. Try again.', false) }
    setSaving(false); setConfirmOut(null)
  }

  // ── Add Intern ────────────────────────────────────────────────────
  const handleAddIntern = async (form:AddInternForm) => {
    setSaving(true)
    try {
      const r = await fetch('/api/interns',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({...form, requiredHours: parseInt(form.requiredHours)||486}),
      })
      if (!r.ok) throw new Error('Failed')
      fetch('/api/sheets/interns',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({type:'intern',data:form})}).catch(()=>{})
      showToast(`${form.fullName} has been registered`); setShowAdd(false); await fetchInterns()
    } catch { showToast('Failed to register intern',false) }
    setSaving(false)
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
      await fetch(`/api/interns/${selected.id}/tasks`,{method:'PATCH',headers:{'Content-Type':'application/json'},
        body: JSON.stringify({taskId:task.id,status})})
      await fetchTasks(selected.id)
    } catch {}
  }

  // ── Derived ───────────────────────────────────────────────────────
  const activeInterns = useMemo(()=>interns.filter(i=>i.status==='ACTIVE'),[interns])
  const filteredInterns = useMemo(()=>{
    let list = interns
    if (filterSchool !== 'all') list = list.filter(i=>i.school===filterSchool)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(i=>i.fullName.toLowerCase().includes(q)||i.school.toLowerCase().includes(q)||i.course.toLowerCase().includes(q))
    }
    return list
  },[interns,filterSchool,search])

  const clockedInInterns = useMemo(()=>interns.filter(i=>clocks[i.id]),[interns,clocks])
  const todayStr = new Date().toISOString().slice(0,10)
  const todayLogs = useMemo(()=>interns.flatMap(i=>i.attendance.filter(a=>a.date.slice(0,10)===todayStr).map(a=>({...a,intern:i}))),[interns,todayStr])
  const totalHours = useMemo(()=>interns.reduce((s,i)=>s+i.totalHours,0),[interns])
  const pendingTasks = useMemo(()=>interns.flatMap(i=>i.tasks).filter(t=>t.status==='PENDING'||t.status==='IN_PROGRESS').length,[interns])
  const schoolGroups = useMemo(()=>{
    const map = new Map<string,Intern[]>()
    interns.forEach(i=>{ if(!map.has(i.school)) map.set(i.school,[]); map.get(i.school)!.push(i) })
    return Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0]))
  },[interns])

  const inputCls = "w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"

  // ═══════════════════════════════════════════════════════════════════
  // ACCESS GATE (overlay)
  // ═══════════════════════════════════════════════════════════════════
  if (!access) {
    return (
      <div className="min-h-[100dvh] flex flex-col" style={{fontFamily:"'Plus Jakarta Sans', sans-serif"}}>
        {/* Gov header behind the gate */}
        <header className="bg-[var(--dict-blue)] shadow-lg z-10">
          <div className="flex h-1.5"><div className="flex-1 bg-[#0038A8]"/><div className="flex-1 bg-[#CE1126]"/><div className="flex-1 bg-[#FCD116]"/></div>
          <div className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GovSeal/>
              <div>
                <div className="font-display font-bold text-white text-sm">DTC Region V · Intern Attendance Portal</div>
                <div className="text-blue-200 text-xs">Digital Transformation Center — Logbook</div>
              </div>
            </div>
            <GovHeaderLogos/>
          </div>
        </header>
        {/* Gate overlay */}
        <div className="flex-1 flex items-center justify-center p-4 bg-[var(--bg-page)]">
          <div className="glass rounded-3xl p-8 w-full max-w-sm shadow-2xl">
            <div className="text-center mb-7">
              <div className="w-16 h-16 bg-gradient-to-br from-[var(--dict-blue)] to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl shadow-lg">🎓</div>
              <h1 className="font-display font-bold text-2xl text-gray-800">Intern Portal</h1>
              <p className="text-gray-500 text-sm mt-1">Enter your access code to continue</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Access Code</label>
                <input type="password" value={codeInput} onChange={e=>setCodeInput(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&verifyCode()} placeholder="Enter access code" autoFocus
                  className={inputCls}/>
                {codeError && <p className="text-red-500 text-xs mt-1.5 pl-1">{codeError}</p>}
              </div>
              <button onClick={verifyCode} disabled={checking||!codeInput}
                className="w-full py-3 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white rounded-xl font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                {checking ? <><Spinner/>Verifying...</> : 'Enter Portal'}
              </button>
            </div>
            <p className="text-center text-gray-400 text-xs mt-6">Contact admin for access code · <Link href="/" className="text-[var(--dict-blue)] hover:underline font-semibold">← Back to Home</Link></p>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAIN LAYOUT
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-[100dvh] flex flex-col" style={{fontFamily:"'Plus Jakarta Sans', sans-serif"}}>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-white text-sm font-semibold ${toast.ok?'bg-green-600':'bg-red-600'}`} style={{minWidth:'240px'}}>
          <span>{toast.ok?'✓':'⚠️'}</span>
          <p className="flex-1">{toast.msg}</p>
        </div>
      )}

      {/* Modals */}
      {showAdd && <AddInternModal onClose={()=>setShowAdd(false)} onSave={handleAddIntern} saving={saving}/>}

      {confirmOut && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-xl flex-shrink-0">⏹️</div>
              <div>
                <p className="font-display font-bold text-lg text-gray-800 leading-tight">Time Out</p>
                <p className="text-gray-500 text-sm">
                  Clocking out <span className="font-bold text-gray-800">{confirmOut.fullName}</span>
                  {' · '}<span className="font-mono text-[var(--dict-blue)] font-bold">{fmt(elapsed[confirmOut.id]||0)}</span> elapsed
                </p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                Progress Note <span className="text-red-500">*</span>
              </label>
              <textarea
                value={progressNote}
                onChange={e => setProgressNote(e.target.value)}
                placeholder="What did you accomplish today? (required)"
                rows={4}
                autoFocus
                className="w-full border-2 border-gray-200 focus:border-[var(--dict-blue)] rounded-xl px-4 py-3 text-sm outline-none resize-none transition-colors"
              />
              <p className="text-xs text-gray-400 mt-1">This note will be saved to your attendance record and visible to your supervisor.</p>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setConfirmOut(null); setProgressNote('') }}
                className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => handleTimeOutConfirmed(confirmOut)} disabled={saving || !progressNote.trim()}
                className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2 transition-all">
                {saving ? <><Spinner/>Saving...</> : '✓ Confirm Time Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Government Header ────────────────────────────────────────────── */}
      <header className="bg-[var(--dict-blue)] shadow-lg flex-shrink-0 z-30">
        <div className="flex h-1.5"><div className="flex-1 bg-[#0038A8]"/><div className="flex-1 bg-[#CE1126]"/><div className="flex-1 bg-[#FCD116]"/></div>
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-3">
              <button onClick={()=>setSideOpen(o=>!o)} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
              </button>
              <GovSeal/>
              <div>
                <div className="font-display font-bold text-white text-sm">DTC Region V · Intern Attendance Portal</div>
                <div className="text-blue-200 text-xs">Digital Transformation Center — Logbook</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={()=>setShowAdd(true)} className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-white text-xs font-semibold transition-all">
                + Add Intern
              </button>
              <Link href="/" className="text-xs px-3 py-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-all">← Home</Link>
              <button onClick={()=>{localStorage.removeItem('dtc_intern_access_v2');setAccess(false)}} className="text-xs px-3 py-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-all">🔒 Lock</button>
              <GovHeaderLogos/>
            </div>
          </div>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ────────────────────────────────────────────────────── */}
        <aside className="flex-shrink-0 h-full overflow-y-auto transition-all duration-300 ease-in-out z-20 relative"
          style={{width: sideOpen ? 240 : 64}}>
          <div className="glass h-full border-r border-white/40 flex flex-col" style={{minHeight:'calc(100vh - 80px)'}}>

            {/* Intern count badge */}
            <div className={`flex-shrink-0 overflow-hidden transition-all duration-300 ${sideOpen?'px-4 py-4':'px-2 py-3'}`}>
              {sideOpen ? (
                <div className="bg-gradient-to-br from-[var(--dict-blue)] to-blue-700 rounded-2xl p-4 text-white shadow-lg">
                  <p className="text-xs text-blue-200 font-medium">Total Interns</p>
                  <p className="text-3xl font-display font-bold mt-1">{interns.length}</p>
                  <p className="text-xs text-blue-200 mt-1">{activeInterns.length} currently active</p>
                </div>
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-[var(--dict-blue)] to-blue-700 rounded-xl flex items-center justify-center text-white font-bold text-sm mx-auto shadow-lg">
                  {interns.length}
                </div>
              )}
            </div>

            {/* Nav items */}
            <nav className="flex-shrink-0 px-2 pt-1 space-y-1">
              {NAV_ITEMS.map(item=>{
                const active = view === item.id
                return (
                  <button key={item.id} onClick={()=>setView(item.id)}
                    className={`w-full flex items-center gap-3 rounded-xl transition-all duration-150 ${sideOpen?'px-3 py-2.5':'px-0 py-2.5 justify-center'} ${
                      active ? 'bg-[var(--dict-blue)] text-white shadow-md shadow-blue-200' : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
                    }`} title={!sideOpen?item.label:undefined}>
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    {sideOpen && (
                      <div className="text-left min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate">{item.label}</p>
                        <p className={`text-xs leading-tight truncate ${active?'text-blue-200':'text-gray-400'}`}>{item.description}</p>
                      </div>
                    )}
                    {sideOpen && item.id==='track' && clockedInInterns.length>0 && (
                      <span className="ml-auto bg-green-500 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">{clockedInInterns.length}</span>
                    )}
                    {sideOpen && active && item.id!=='track' && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70 flex-shrink-0"/>
                    )}
                  </button>
                )
              })}
            </nav>

            {/* School Directory */}
            {sideOpen && schoolGroups.length>0 && (
              <div className="flex-1 px-3 py-3 min-h-0 overflow-y-auto">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <span className="flex-1 h-px bg-gray-200"/>Schools<span className="flex-1 h-px bg-gray-200"/>
                </p>
                <div className="space-y-1">
                  <button onClick={()=>{setFilterSchool('all');setView('interns')}}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition-all ${filterSchool==='all'&&view==='interns'?'bg-[var(--dict-blue)]/10 text-[var(--dict-blue)] font-bold':'text-gray-600 hover:bg-gray-100'}`}>
                    <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0"/>
                    <span className="truncate font-semibold">All Schools</span>
                    <span className="ml-auto text-[10px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-bold flex-shrink-0">{interns.length}</span>
                  </button>
                  {schoolGroups.map(([school,members])=>{
                    const sc = getSchoolColor(school)
                    const isActive = filterSchool===school && view==='interns'
                    return (
                      <button key={school} onClick={()=>{setFilterSchool(school);setView('interns')}}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition-all ${isActive?`${sc.light} ${sc.text} font-bold ring-1 ${sc.ring}`:'text-gray-600 hover:bg-gray-100'}`}>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`}/>
                        <div className="flex-1 text-left min-w-0">
                          <p className="truncate font-semibold leading-tight">{school}</p>
                          <p className="text-[10px] text-gray-400">{members.filter(m=>m.status==='ACTIVE').length} active</p>
                        </div>
                        <span className={`text-[10px] ${sc.bg} ${sc.text} rounded-full px-1.5 py-0.5 font-bold flex-shrink-0`}>{members.length}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {!sideOpen && schoolGroups.length>0 && (
              <div className="flex flex-col items-center gap-1.5 py-2">
                {schoolGroups.map(([school])=>{const sc=getSchoolColor(school); return (
                  <span key={school} title={school} className={`w-2.5 h-2.5 rounded-full ${sc.dot} cursor-pointer`} onClick={()=>{setFilterSchool(school);setView('interns')}}/>
                )})}
              </div>
            )}

            {/* Sidebar quick actions */}
            {sideOpen && (
              <div className="px-4 pb-6 space-y-2 flex-shrink-0">
                <button onClick={()=>setShowAdd(true)}
                  className="w-full py-2.5 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white rounded-xl text-xs font-bold hover:shadow-md transition-all flex items-center justify-center gap-2">
                  + Add New Intern
                </button>
                <button onClick={()=>setView('track')}
                  className="w-full py-2 border-2 border-green-300 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-50 transition-all flex items-center justify-center gap-2">
                  ⏱ Time Track
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main Content ────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-5 space-y-5 bg-[var(--bg-page)]">

          {/* ════ OVERVIEW ════════════════════════════════════════════════ */}
          {view==='overview' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-display font-bold text-2xl text-gray-800">Intern Overview</h1>
                  <p className="text-sm text-gray-500 mt-0.5">Summary of all internship activity at DTC Region V</p>
                </div>
                <button onClick={()=>setShowAdd(true)} className="px-4 py-2 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                  + Add Intern
                </button>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {([
                  { label:'Total Interns',    value:interns.length,                              icon:'👥', color:'from-blue-500 to-indigo-600',   sub:`${activeInterns.length} active`      },
                  { label:'Hours Logged',     value:`${Math.round(totalHours)}h`,               icon:'⏱️', color:'from-green-500 to-emerald-600',  sub:'across all interns'                  },
                  { label:'Pending Tasks',    value:pendingTasks,                               icon:'✅', color:'from-purple-500 to-purple-700',  sub:'need attention'                      },
                  { label:"Today's Present",  value:todayLogs.filter(a=>a.status==='PRESENT').length, icon:'📅', color:'from-orange-500 to-red-500', sub:`of ${activeInterns.length} active`},
                ] as {label:string;value:string|number;icon:string;color:string;sub:string}[]).map(c=>(
                  <div key={c.label} className="glass rounded-2xl p-5 shadow-sm">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-xl mb-3 shadow-md`}>{c.icon}</div>
                    <p className="text-2xl font-display font-bold text-gray-800">{c.value}</p>
                    <p className="text-sm font-semibold text-gray-700 mt-0.5">{c.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
                  </div>
                ))}
              </div>

              {/* Clocked in strip */}
              {clockedInInterns.length>0 && (
                <div className="glass rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display font-semibold text-gray-800 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-green-100 text-green-600 flex items-center justify-center text-sm">🟢</span>
                      Currently Clocked In
                    </h2>
                    <span className="flex items-center gap-1.5 text-green-600 text-xs font-bold">
                      <span className="relative flex h-2 w-2"><span className="animate-ping absolute inset-0 rounded-full bg-green-400 opacity-75"/><span className="relative block rounded-full h-2 w-2 bg-green-500"/></span>
                      {clockedInInterns.length} Active
                    </span>
                  </div>
                  <div className="space-y-2">
                    {clockedInInterns.map(i=>(
                      <div key={i.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                        <Avatar name={i.fullName} photo={i.photoUrl} size="md"/>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-gray-800 truncate">{i.fullName}</p>
                          <p className="text-xs text-gray-500 truncate">{i.school}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-green-700 font-mono font-bold text-sm">{fmt(elapsed[i.id]||0)}</p>
                          <p className="text-gray-400 text-[10px]">since {fmtTime(clocks[i.id]?.startTime||'')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Today log */}
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-semibold text-gray-800 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-sm">📅</span>
                    Today&apos;s Attendance
                  </h2>
                  <p className="text-xs text-gray-400">{new Date().toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric'})}</p>
                </div>
                {todayLogs.length===0 ? (
                  <p className="text-center text-gray-400 text-sm py-6">No attendance logged today yet</p>
                ) : (
                  <div className="space-y-2">
                    {todayLogs.map(a=>(
                      <div key={a.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <Avatar name={a.intern.fullName} photo={a.intern.photoUrl} size="sm"/>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-gray-800 truncate">{a.intern.fullName}</p>
                          <p className="text-xs text-gray-500">{a.intern.school}</p>
                        </div>
                        <div className="text-right text-xs">
                          <p className="font-semibold text-gray-700">{a.timeIn?fmtTime(a.timeIn):'—'} → {a.timeOut?fmtTime(a.timeOut):<span className="text-green-600 font-bold">Active</span>}</p>
                          {a.hours!=null&&<p className="text-[var(--dict-blue)] font-bold">{a.hours}h</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Progress overview */}
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-semibold text-gray-800 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm">📈</span>
                    Intern Progress
                  </h2>
                  <button onClick={()=>setView('interns')} className="text-xs text-[var(--dict-blue)] hover:underline font-semibold">View all →</button>
                </div>
                {loading ? (
                  <div className="space-y-3">{[...Array(3)].map((_,i)=>(
                    <div key={i} className="animate-pulse flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0"/>
                      <div className="flex-1 space-y-1.5"><div className="h-3 bg-gray-200 rounded-full w-1/2"/><div className="h-2 bg-gray-100 rounded-full"/></div>
                    </div>
                  ))}</div>
                ) : interns.length===0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm mb-3">No interns registered yet</p>
                    <button onClick={()=>setShowAdd(true)} className="px-4 py-2 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white rounded-xl text-xs font-bold">+ Add First Intern</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {interns.slice(0,6).map(i=>{
                      const sc = getSchoolColor(i.school)
                      const dept = getDeptBadge(i)
                      const statusMeta = STATUS_META[i.status] || STATUS_META.INACTIVE
                      return (
                        <div key={i.id} className="flex items-center gap-4 cursor-pointer hover:bg-white/50 rounded-xl p-2 -mx-2 transition-all" onClick={()=>{setSelected(i);setView('attendance')}}>
                          <Avatar name={i.fullName} photo={i.photoUrl} size="md"/>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="font-semibold text-sm text-gray-800 truncate">{i.fullName}</p>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${statusMeta.badge}`}>{statusMeta.label}</span>
                            </div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${sc.bg} ${sc.text} flex-shrink-0`}>{i.school}</span>
                              {dept && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${dept.color} flex-shrink-0`}>{dept.icon} {dept.short}</span>}
                            </div>
                            <HoursProgress current={i.totalHours} required={i.requiredHours}/>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════ INTERN ROSTER ══════════════════════════════════════════ */}
          {view==='interns' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-display font-bold text-2xl text-gray-800">Intern Roster</h1>
                  <p className="text-sm text-gray-500 mt-0.5">{filteredInterns.length} intern{filteredInterns.length!==1?'s':''} {filterSchool!=='all'?`from ${filterSchool}`:''}</p>
                </div>
                <button onClick={()=>setShowAdd(true)} className="px-4 py-2 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                  + Add Intern
                </button>
              </div>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, school or course..."
                    className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm outline-none focus:border-[var(--dict-blue)] bg-white"/>
                </div>
              </div>
              {loading ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_,i)=>(
                  <div key={i} className="glass rounded-2xl p-5 animate-pulse space-y-3">
                    <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-gray-200"/><div className="flex-1 space-y-1.5"><div className="h-3 bg-gray-200 rounded-full"/><div className="h-2 bg-gray-100 rounded-full w-3/4"/></div></div>
                    <div className="h-2 bg-gray-100 rounded-full"/>
                  </div>
                ))}</div>
              ) : filteredInterns.length===0 ? (
                <div className="glass rounded-2xl p-10 text-center">
                  <p className="text-3xl mb-3">👥</p>
                  <p className="text-gray-500 text-sm mb-4">{search||filterSchool!=='all'?'No interns match your filters':'No interns registered yet'}</p>
                  {!search && filterSchool==='all' && <button onClick={()=>setShowAdd(true)} className="px-5 py-2.5 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white rounded-xl text-sm font-bold">+ Register First Intern</button>}
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredInterns.map(intern=>{
                    const sc = getSchoolColor(intern.school)
                    const dept = getDeptBadge(intern)
                    const statusMeta = STATUS_META[intern.status] || STATUS_META.INACTIVE
                    const clocked = !!clocks[intern.id]
                    return (
                      <div key={intern.id} className="glass rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                        onClick={()=>{setSelected(intern);setView('attendance')}}>
                        <div className="flex items-start gap-3 mb-4">
                          <div className="relative">
                            <Avatar name={intern.fullName} photo={intern.photoUrl} size="md"/>
                            {clocked && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"/>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800 text-sm truncate group-hover:text-[var(--dict-blue)] transition-colors">{intern.fullName}</p>
                            <p className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${sc.bg} ${sc.text}`}>{intern.school}</p>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{intern.course}</p>
                            {intern.supervisor && <p className="text-[11px] text-[var(--dict-blue)] mt-0.5 truncate">📋 {intern.supervisor}</p>}
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${statusMeta.badge}`}>{statusMeta.label}</span>
                        </div>
                        {dept && <div className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold mb-3 ${dept.color}`}>{dept.icon} {dept.short}</div>}
                        <HoursProgress current={intern.totalHours} required={intern.requiredHours}/>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════ TIME TRACK ══════════════════════════════════════════════ */}
          {view==='track' && (
            <div className="space-y-5">
              <div>
                <h1 className="font-display font-bold text-2xl text-gray-800">Time Track</h1>
                <p className="text-sm text-gray-500 mt-0.5">Search your name to clock in or out</p>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search your name..."
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm outline-none focus:border-[var(--dict-blue)] bg-white"/>
              </div>
              {loading ? (
                <div className="space-y-3">{[...Array(5)].map((_,i)=>(
                  <div key={i} className="glass rounded-2xl p-4 animate-pulse flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200"/><div className="flex-1 space-y-1.5"><div className="h-3 bg-gray-200 rounded-full w-1/2"/><div className="h-2 bg-gray-100 rounded-full w-1/3"/></div>
                    <div className="w-24 h-9 bg-gray-200 rounded-xl"/>
                  </div>
                ))}</div>
              ) : (
                <div className="space-y-3">
                  {filteredInterns.map(intern=>{
                    const clocked = !!clocks[intern.id]
                    const sc = getSchoolColor(intern.school)
                    return (
                      <div key={intern.id} className={`glass rounded-2xl p-4 flex items-center gap-4 transition-all ${clocked?'ring-2 ring-green-400 shadow-md':''}`}>
                        <Avatar name={intern.fullName} photo={intern.photoUrl} size="md"/>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800">{intern.fullName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${sc.bg} ${sc.text}`}>{intern.school}</span>
                          </div>
                          {clocked && <p className="text-green-700 font-mono font-bold text-sm mt-1">{fmt(elapsed[intern.id]||0)}</p>}
                        </div>
                        {clocked ? (
                          <button onClick={()=>setConfirmOut(intern)} disabled={saving}
                            className="px-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 rounded-xl text-white text-sm font-bold disabled:opacity-50 hover:shadow-md transition-all">
                            Time Out
                          </button>
                        ) : (
                          <button onClick={()=>handleTimeIn(intern)}
                            className="px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl text-white text-sm font-bold hover:shadow-md transition-all">
                            Time In
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {filteredInterns.length===0 && <p className="text-center py-12 text-gray-400 text-sm glass rounded-2xl">No results. Try a different name.</p>}
                </div>
              )}
            </div>
          )}

          {/* ════ ATTENDANCE / DTR ════════════════════════════════════════ */}
          {view==='attendance' && (
            <div className="space-y-5">
              <h1 className="font-display font-bold text-2xl text-gray-800">Attendance / DTR</h1>
              <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
                {interns.map(i=>{
                  const sc = getSchoolColor(i.school)
                  return (
                    <button key={i.id} onClick={()=>setSelected(i)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-all
                        ${selected?.id===i.id?`${sc.light} ${sc.text} ${sc.border} shadow-sm`:'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'}`}>
                      <Avatar name={i.fullName} photo={i.photoUrl} size="sm"/>
                      {i.fullName.split(' ')[0]}
                    </button>
                  )
                })}
              </div>
              {!selected ? (
                <div className="glass rounded-2xl p-10 text-center text-gray-400 text-sm">Select an intern above to view their attendance</div>
              ) : (
                <div className="glass rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-white/50 flex items-start gap-4">
                    <Avatar name={selected.fullName} photo={selected.photoUrl} size="lg"/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h2 className="font-display font-bold text-xl text-gray-800">{selected.fullName}</h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${STATUS_META[selected.status]?.badge||STATUS_META.INACTIVE.badge}`}>{STATUS_META[selected.status]?.label||selected.status}</span>
                      </div>
                      <p className="text-sm text-gray-500">{selected.school} · {selected.course}</p>
                      {selected.supervisor && <p className="text-xs text-[var(--dict-blue)] mt-0.5">📋 Coordinator: {selected.supervisor}</p>}
                      <div className="mt-3 max-w-xs"><HoursProgress current={selected.totalHours} required={selected.requiredHours}/></div>
                    </div>
                    <div className="hidden sm:grid grid-cols-3 gap-4 text-center flex-shrink-0">
                      {[
                        {val:Math.round(selected.totalHours),label:'Hours Logged',color:'text-[var(--dict-blue)]'},
                        {val:selected.requiredHours,label:'Required',color:'text-gray-700'},
                        {val:selected.attendance.filter(a=>a.status==='PRESENT').length,label:'Days Present',color:'text-green-600'},
                      ].map(s=>(
                        <div key={s.label} className="bg-white/70 rounded-xl px-4 py-3">
                          <p className={`text-xl font-display font-bold ${s.color}`}>{s.val}</p>
                          <p className="text-[10px] text-gray-500 font-semibold">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-gray-50/80 text-[11px] font-black text-gray-500 uppercase tracking-wider border-b border-gray-100">
                        <th className="px-6 py-3 text-left">Date</th>
                        <th className="px-6 py-3 text-left">Time In</th>
                        <th className="px-6 py-3 text-left">Time Out</th>
                        <th className="px-6 py-3 text-left">Hours</th>
                        <th className="px-6 py-3 text-left">Status</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {selected.attendance.length===0 ? (
                          <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400">No attendance records yet</td></tr>
                        ) : selected.attendance.map(a=>(
                          <tr key={a.id} className="hover:bg-white/50 transition-colors">
                            <td className="px-6 py-3 font-medium text-gray-700 whitespace-nowrap">{fmtDate(a.date)}</td>
                            <td className="px-6 py-3 text-gray-600 whitespace-nowrap">{a.timeIn?fmtTime(a.timeIn):'—'}</td>
                            <td className="px-6 py-3 text-gray-600 whitespace-nowrap">{a.timeOut?fmtTime(a.timeOut):<span className="text-green-600 font-semibold">Active</span>}</td>
                            <td className="px-6 py-3 font-bold text-[var(--dict-blue)] whitespace-nowrap">{a.hours!=null?`${a.hours}h`:'—'}</td>
                            <td className="px-6 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                a.status==='PRESENT'?'bg-green-50 text-green-700 border-green-200':a.status==='ABSENT'?'bg-red-50 text-red-600 border-red-200':'bg-yellow-50 text-yellow-700 border-yellow-200'
                              }`}>{a.status}</span>
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

          {/* ════ TASKS ═══════════════════════════════════════════════════ */}
          {view==='tasks' && (
            <div className="space-y-5">
              <h1 className="font-display font-bold text-2xl text-gray-800">Tasks</h1>
              <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
                {interns.map(i=>{
                  const sc = getSchoolColor(i.school)
                  return (
                    <button key={i.id} onClick={()=>{setSelected(i);fetchTasks(i.id)}}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-all
                        ${selected?.id===i.id?`${sc.light} ${sc.text} ${sc.border} shadow-sm`:'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'}`}>
                      <Avatar name={i.fullName} photo={i.photoUrl} size="sm"/>
                      {i.fullName.split(' ')[0]}
                    </button>
                  )
                })}
              </div>
              {!selected ? (
                <div className="glass rounded-2xl p-10 text-center text-gray-400 text-sm">Select an intern above to view their task list</div>
              ) : (
                <div className="glass rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/50 flex items-center gap-3">
                    <Avatar name={selected.fullName} photo={selected.photoUrl} size="md"/>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-gray-800">{selected.fullName}</p>
                      <p className="text-xs text-gray-500">{selected.course} · {selected.school}</p>
                    </div>
                    <span className="text-xs font-bold text-gray-500 bg-white/70 px-3 py-1.5 rounded-full border border-gray-200">
                      {tasks.filter(t=>t.status==='COMPLETED').length}/{tasks.length} done
                    </span>
                  </div>
                  {/* Add task */}
                  <div className="px-6 py-3 border-b border-white/30 flex gap-2 bg-gray-50/50">
                    <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTask()}
                      placeholder="Type a task and press Enter to add..."
                      className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-[var(--dict-blue)] bg-white"/>
                    <button onClick={addTask} disabled={!newTask.trim()}
                      className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-xl text-sm font-bold disabled:opacity-40 flex items-center gap-1.5 hover:shadow-md transition-all">
                      + Add
                    </button>
                  </div>
                  {/* Task list */}
                  {tasks.length===0 ? (
                    <p className="px-6 py-10 text-center text-gray-400 text-sm">No tasks yet. Add one above!</p>
                  ) : (
                    <div className="divide-y divide-gray-50/80">
                      {[...tasks].sort((a,b)=>a.status==='COMPLETED'?1:b.status==='COMPLETED'?-1:0).map(task=>{
                        const pMeta = PRIORITY_META[task.priority] || PRIORITY_META.MEDIUM
                        return (
                          <div key={task.id} className="flex items-start gap-3 px-6 py-4 hover:bg-white/50 cursor-pointer transition-colors" onClick={()=>toggleTask(task)}>
                            <div className={`mt-0.5 w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all
                              ${task.status==='COMPLETED'?'bg-green-500 border-green-500':'border-gray-300 hover:border-[var(--dict-blue)]'}`}>
                              {task.status==='COMPLETED' && <span className="text-white text-[10px] font-black">✓</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold transition-colors ${task.status==='COMPLETED'?'line-through text-gray-400':'text-gray-800'}`}>{task.title}</p>
                              {task.description && <p className="text-xs text-gray-400 mt-0.5">{task.description}</p>}
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${pMeta.color}`}>{pMeta.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
