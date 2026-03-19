'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useUser, UserButton } from '@clerk/nextjs'
import { GovSeal, GovHeaderLogos } from '@/components/GovernmentHeader'
import { format, differenceInDays } from 'date-fns'

// ─── Types ─────────────────────────────────────────────────────────────────────
type InternStatus = 'ACTIVE' | 'COMPLETED' | 'INACTIVE' | 'ON_LEAVE'
type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'HOLIDAY'
type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

type Intern = {
  id: string
  fullName: string
  school: string
  course: string
  department: string | null
  supervisor: string | null
  startDate: string
  endDate: string
  requiredHours: number
  totalHours: number
  status: InternStatus
  email: string | null
  phone: string | null
  photoUrl: string | null
  notes: string | null
  attendance: AttendanceRecord[]
  tasks: Task[]
  documents: Document[]
  createdAt: string
}

type AttendanceRecord = {
  id: string
  internId: string
  date: string
  timeIn: string | null
  timeOut: string | null
  hours: number | null
  status: AttendanceStatus
  notes: string | null
}

type Task = {
  id: string
  internId: string
  title: string
  description: string | null
  status: TaskStatus
  priority: string
  dueDate: string | null
  completedAt: string | null
  createdAt: string
}

type Document = {
  id: string
  internId: string
  name: string
  type: string
  url: string
  uploadedBy: string | null
  createdAt: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const INTERN_STATUS_META: Record<InternStatus, { label: string; dot: string; badge: string; bg: string }> = {
  ACTIVE:    { label: 'Active',    dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700 border-green-300',   bg: 'from-green-50 to-emerald-50' },
  COMPLETED: { label: 'Completed', dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700 border-blue-300',      bg: 'from-blue-50 to-indigo-50' },
  INACTIVE:  { label: 'Inactive',  dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-500 border-gray-300',      bg: 'from-gray-50 to-slate-50' },
  ON_LEAVE:  { label: 'On Leave',  dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700 border-yellow-300', bg: 'from-yellow-50 to-amber-50' },
}

const TASK_STATUS_META: Record<TaskStatus, { label: string; color: string; icon: string }> = {
  PENDING:     { label: 'Pending',     color: 'bg-gray-100 text-gray-700 border-gray-300',     icon: '⏳' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-700 border-blue-300',     icon: '🔄' },
  COMPLETED:   { label: 'Completed',   color: 'bg-green-100 text-green-700 border-green-300',  icon: '✅' },
  CANCELLED:   { label: 'Cancelled',   color: 'bg-red-100 text-red-700 border-red-300',        icon: '❌' },
}

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  LOW:    { label: 'Low',    color: 'bg-gray-100 text-gray-600' },
  MEDIUM: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  HIGH:   { label: 'High',   color: 'bg-orange-100 text-orange-700' },
  URGENT: { label: 'Urgent', color: 'bg-red-100 text-red-700' },
}

const ATTENDANCE_STATUS_META: Record<AttendanceStatus, { label: string; color: string; icon: string }> = {
  PRESENT:  { label: 'Present',  color: 'bg-green-100 text-green-700',  icon: '✓' },
  ABSENT:   { label: 'Absent',   color: 'bg-red-100 text-red-700',      icon: '✗' },
  HALF_DAY: { label: 'Half Day', color: 'bg-yellow-100 text-yellow-700', icon: '½' },
  LEAVE:    { label: 'Leave',    color: 'bg-blue-100 text-blue-700',    icon: '🏖' },
  HOLIDAY:  { label: 'Holiday',  color: 'bg-purple-100 text-purple-700', icon: '🎉' },
}

type NavSection = 'overview' | 'interns' | 'attendance' | 'tasks' | 'documents' | 'reports'

const NAV_ITEMS: { id: NavSection; label: string; icon: string; description: string }[] = [
  { id: 'overview',    label: 'Overview',       icon: '📊', description: 'Dashboard & stats' },
  { id: 'interns',     label: 'Intern Roster',  icon: '👥', description: 'Manage interns' },
  { id: 'attendance',  label: 'Attendance/DTR', icon: '📅', description: 'Time records' },
  { id: 'tasks',       label: 'Tasks',          icon: '✅', description: 'Assign & track' },
  { id: 'documents',   label: 'Documents',      icon: '📁', description: 'Files & records' },
  { id: 'reports',     label: 'Reports',        icon: '📈', description: 'Summaries' },
]

// ─── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/>
}

// ─── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, photo, size = 'md' }: { name?: string; photo?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-lg' : size === 'xl' ? 'w-20 h-20 text-2xl' : 'w-10 h-10 text-sm'
  const initials = name?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
  if (photo) return <img src={photo} className={`${sz} rounded-full object-cover flex-shrink-0 border-2 border-white shadow-sm`} alt={name || 'Intern'}/>
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm`}>
      {initials}
    </div>
  )
}

// ─── Progress Bar ──────────────────────────────────────────────────────────────
function HoursProgress({ current, required }: { current: number; required: number }) {
  const pct = Math.min(100, Math.round((current / required) * 100))
  const color = pct >= 100 ? 'from-green-400 to-emerald-500' : pct >= 70 ? 'from-blue-400 to-indigo-500' : pct >= 40 ? 'from-yellow-400 to-orange-400' : 'from-red-400 to-rose-500'
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500 font-medium">{Math.round(current)}h / {required}h</span>
        <span className={`text-xs font-bold ${pct >= 100 ? 'text-green-600' : pct >= 70 ? 'text-blue-600' : 'text-orange-600'}`}>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full bg-gradient-to-r ${color} transition-all duration-500`} style={{ width: `${pct}%` }}/>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function InternsPage() {
  const { isLoaded: clerkLoaded, isSignedIn } = useUser()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeSection, setActiveSection] = useState<NavSection>('overview')
  const [interns, setInterns] = useState<Intern[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIntern, setSelectedIntern] = useState<Intern | null>(null)

  // Form modals
  const [showAddIntern, setShowAddIntern] = useState(false)
  const [showAddAttendance, setShowAddAttendance] = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)

  // Add intern form state
  const [newIntern, setNewIntern] = useState({
    fullName: '', school: '', course: '', department: '', supervisor: '',
    startDate: '', endDate: '', requiredHours: '486', email: '', phone: '', notes: ''
  })

  // Add attendance form state
  const [newAttendance, setNewAttendance] = useState({
    internId: '', date: format(new Date(), 'yyyy-MM-dd'),
    timeIn: '08:00', timeOut: '17:00', status: 'PRESENT', notes: ''
  })

  // Add task form state
  const [newTask, setNewTask] = useState({
    internId: '', title: '', description: '', priority: 'MEDIUM', dueDate: ''
  })

  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // ─── Data Fetching ────────────────────────────────────────────────────────────
  const fetchInterns = useCallback(async () => {
    try {
      const r = await fetch('/api/interns')
      if (r.ok) {
        const data = await r.json()
        setInterns(data)
        // Refresh selected intern if any
        if (selectedIntern) {
          const updated = data.find((i: Intern) => i.id === selectedIntern.id)
          if (updated) setSelectedIntern(updated)
        }
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [selectedIntern])

  useEffect(() => {
    if (isSignedIn) fetchInterns()
  }, [isSignedIn, fetchInterns])

  // ─── Derived data ─────────────────────────────────────────────────────────────
  const activeInterns = useMemo(() => interns.filter(i => i.status === 'ACTIVE'), [interns])
  const filteredInterns = useMemo(() => {
    let list = interns
    if (filterStatus !== 'all') list = list.filter(i => i.status === filterStatus)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(i =>
        i.fullName.toLowerCase().includes(q) ||
        i.school.toLowerCase().includes(q) ||
        i.course.toLowerCase().includes(q)
      )
    }
    return list
  }, [interns, filterStatus, searchQuery])

  const allTasks = useMemo(() => interns.flatMap(i => i.tasks.map(t => ({ ...t, internName: i.fullName }))), [interns])
  const pendingTasksCount = useMemo(() => allTasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length, [allTasks])

  const totalHoursLogged = useMemo(() => interns.reduce((s, i) => s + i.totalHours, 0), [interns])

  const todayAttendance = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    return interns.flatMap(i => i.attendance.filter(a => a.date.startsWith(today)).map(a => ({ ...a, internName: i.fullName })))
  }, [interns])

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  const handleAddIntern = async () => {
    if (!newIntern.fullName || !newIntern.school || !newIntern.course || !newIntern.startDate || !newIntern.endDate) return
    setSaving(true)
    try {
      const r = await fetch('/api/interns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newIntern)
      })
      if (r.ok) {
        await fetchInterns()
        setShowAddIntern(false)
        setNewIntern({ fullName: '', school: '', course: '', department: '', supervisor: '', startDate: '', endDate: '', requiredHours: '486', email: '', phone: '', notes: '' })
      }
    } finally { setSaving(false) }
  }

  const handleStatusChange = async (internId: string, status: InternStatus) => {
    await fetch(`/api/interns/${internId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    fetchInterns()
  }

  const handleDeleteIntern = async (internId: string) => {
    if (!confirm('Delete this intern and all their records? This cannot be undone.')) return
    await fetch(`/api/interns/${internId}`, { method: 'DELETE' })
    if (selectedIntern?.id === internId) setSelectedIntern(null)
    fetchInterns()
  }

  const handleAddAttendance = async () => {
    if (!newAttendance.internId) return
    setSaving(true)
    try {
      const date = newAttendance.date
      const timeIn = newAttendance.timeIn ? `${date}T${newAttendance.timeIn}:00` : null
      const timeOut = newAttendance.timeOut ? `${date}T${newAttendance.timeOut}:00` : null

      const r = await fetch(`/api/interns/${newAttendance.internId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, timeIn, timeOut, status: newAttendance.status, notes: newAttendance.notes })
      })
      if (r.ok) {
        await fetchInterns()
        setShowAddAttendance(false)
        setNewAttendance({ internId: '', date: format(new Date(), 'yyyy-MM-dd'), timeIn: '08:00', timeOut: '17:00', status: 'PRESENT', notes: '' })
      }
    } finally { setSaving(false) }
  }

  const handleAddTask = async () => {
    if (!newTask.internId || !newTask.title) return
    setSaving(true)
    try {
      const r = await fetch(`/api/interns/${newTask.internId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      })
      if (r.ok) {
        await fetchInterns()
        setShowAddTask(false)
        setNewTask({ internId: '', title: '', description: '', priority: 'MEDIUM', dueDate: '' })
      }
    } finally { setSaving(false) }
  }

  const handleTaskStatusChange = async (internId: string, taskId: string, status: TaskStatus) => {
    await fetch(`/api/interns/${internId}/tasks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, status })
    })
    fetchInterns()
  }

  const handleDeleteTask = async (internId: string, taskId: string) => {
    await fetch(`/api/interns/${internId}/tasks?taskId=${taskId}`, { method: 'DELETE' })
    fetchInterns()
  }

  const handleDeleteAttendance = async (internId: string, recordId: string) => {
    await fetch(`/api/interns/${internId}/attendance?recordId=${recordId}`, { method: 'DELETE' })
    fetchInterns()
  }

  // ─── Auth Gate ────────────────────────────────────────────────────────────────
  if (!clerkLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--dict-blue)] border-t-transparent rounded-full animate-spin"/>
      </div>
    )
  }
  if (!isSignedIn) {
    if (typeof window !== 'undefined') window.location.href = '/sign-in?redirect_url=/interns'
    return null
  }

  // ─── Modals ───────────────────────────────────────────────────────────────────
  const AddInternModal = () => (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddIntern(false)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="font-display font-bold text-xl text-gray-800">Add New Intern</h2>
          <button onClick={() => setShowAddIntern(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Full Name *</label>
              <input value={newIntern.fullName} onChange={e => setNewIntern(f => ({ ...f, fullName: e.target.value }))}
                placeholder="e.g. Juan Dela Cruz" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">School / University *</label>
              <input value={newIntern.school} onChange={e => setNewIntern(f => ({ ...f, school: e.target.value }))}
                placeholder="e.g. Bicol University" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Course / Program *</label>
              <input value={newIntern.course} onChange={e => setNewIntern(f => ({ ...f, course: e.target.value }))}
                placeholder="e.g. BSIT" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Department</label>
              <input value={newIntern.department} onChange={e => setNewIntern(f => ({ ...f, department: e.target.value }))}
                placeholder="e.g. ICT Division" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Supervisor</label>
              <input value={newIntern.supervisor} onChange={e => setNewIntern(f => ({ ...f, supervisor: e.target.value }))}
                placeholder="e.g. John Smith" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Start Date *</label>
              <input type="date" value={newIntern.startDate} onChange={e => setNewIntern(f => ({ ...f, startDate: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">End Date *</label>
              <input type="date" value={newIntern.endDate} onChange={e => setNewIntern(f => ({ ...f, endDate: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Required Hours</label>
              <input type="number" value={newIntern.requiredHours} onChange={e => setNewIntern(f => ({ ...f, requiredHours: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Email</label>
              <input type="email" value={newIntern.email} onChange={e => setNewIntern(f => ({ ...f, email: e.target.value }))}
                placeholder="intern@email.com" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Phone</label>
              <input value={newIntern.phone} onChange={e => setNewIntern(f => ({ ...f, phone: e.target.value }))}
                placeholder="09XX-XXX-XXXX" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"/>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Notes</label>
              <textarea value={newIntern.notes} onChange={e => setNewIntern(f => ({ ...f, notes: e.target.value }))}
                rows={3} placeholder="Any additional notes..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100 resize-none"/>
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-gray-100">
          <button onClick={() => setShowAddIntern(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleAddIntern} disabled={saving} className="flex-1 py-2.5 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><Spinner/>Saving...</> : '+ Add Intern'}
          </button>
        </div>
      </div>
    </div>
  )

  const AddAttendanceModal = () => (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddAttendance(false)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="font-display font-bold text-xl text-gray-800">Log Attendance</h2>
          <button onClick={() => setShowAddAttendance(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Intern *</label>
            <select value={newAttendance.internId} onChange={e => setNewAttendance(f => ({ ...f, internId: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]">
              <option value="">Select intern...</option>
              {activeInterns.map(i => <option key={i.id} value={i.id}>{i.fullName}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Date</label>
              <input type="date" value={newAttendance.date} onChange={e => setNewAttendance(f => ({ ...f, date: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Time In</label>
              <input type="time" value={newAttendance.timeIn} onChange={e => setNewAttendance(f => ({ ...f, timeIn: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Time Out</label>
              <input type="time" value={newAttendance.timeOut} onChange={e => setNewAttendance(f => ({ ...f, timeOut: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Status</label>
            <select value={newAttendance.status} onChange={e => setNewAttendance(f => ({ ...f, status: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]">
              {Object.entries(ATTENDANCE_STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Notes</label>
            <input value={newAttendance.notes} onChange={e => setNewAttendance(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-gray-100">
          <button onClick={() => setShowAddAttendance(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleAddAttendance} disabled={saving || !newAttendance.internId} className="flex-1 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><Spinner/>Saving...</> : '✓ Log Attendance'}
          </button>
        </div>
      </div>
    </div>
  )

  const AddTaskModal = () => (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddTask(false)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="font-display font-bold text-xl text-gray-800">Assign Task</h2>
          <button onClick={() => setShowAddTask(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Assign To *</label>
            <select value={newTask.internId} onChange={e => setNewTask(f => ({ ...f, internId: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]">
              <option value="">Select intern...</option>
              {activeInterns.map(i => <option key={i.id} value={i.id}>{i.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Task Title *</label>
            <input value={newTask.title} onChange={e => setNewTask(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Update website content" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Description</label>
            <textarea value={newTask.description} onChange={e => setNewTask(f => ({ ...f, description: e.target.value }))}
              rows={3} placeholder="Detailed description of the task" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] resize-none"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Priority</label>
              <select value={newTask.priority} onChange={e => setNewTask(f => ({ ...f, priority: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]">
                {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Due Date</label>
              <input type="date" value={newTask.dueDate} onChange={e => setNewTask(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-gray-100">
          <button onClick={() => setShowAddTask(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleAddTask} disabled={saving || !newTask.internId || !newTask.title} className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><Spinner/>Saving...</> : '+ Assign Task'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Modals */}
      {showAddIntern && <AddInternModal />}
      {showAddAttendance && <AddAttendanceModal />}
      {showAddTask && <AddTaskModal />}

      {/* ── Government Header ─────────────────────────────────────────────────── */}
      <header className="bg-[var(--dict-blue)] shadow-lg flex-shrink-0 z-30">
        <div className="flex h-1.5">
          <div className="flex-1 bg-[#0038A8]"/><div className="flex-1 bg-[#CE1126]"/><div className="flex-1 bg-[#FCD116]"/>
        </div>
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(o => !o)} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all" title="Toggle sidebar">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
              </button>
              <GovSeal/>
              <div>
                <div className="font-display font-bold text-white text-sm">DTC Region V · Intern Management</div>
                <div className="text-blue-200 text-xs">Digital Transformation Center — Internship Portal</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a href="/admin" className="text-xs px-3 py-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5">
                ← Admin Dashboard
              </a>
              <GovHeaderLogos/>
              <UserButton afterSignOutUrl="/sign-in" appearance={{ elements: { avatarBox: 'w-8 h-8' } }}/>
            </div>
          </div>
        </div>
      </header>

      {/* ── Body (sidebar + content) ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Collapsible Side Navigation ──────────────────────────────────────── */}
        <aside
          className="flex-shrink-0 h-full overflow-y-auto transition-all duration-300 ease-in-out z-20 relative"
          style={{ width: sidebarOpen ? 240 : 64 }}
        >
          <div className="glass h-full border-r border-white/40 flex flex-col" style={{ minHeight: 'calc(100vh - 80px)' }}>
            {/* Intern count badge */}
            <div className={`flex-shrink-0 overflow-hidden transition-all duration-300 ${sidebarOpen ? 'px-4 py-4' : 'px-2 py-3'}`}>
              {sidebarOpen ? (
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
            <nav className="flex-1 px-2 pb-4 space-y-1">
              {NAV_ITEMS.map(item => {
                const active = activeSection === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center gap-3 rounded-xl transition-all duration-150 ${
                      sidebarOpen ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'
                    } ${
                      active
                        ? 'bg-[var(--dict-blue)] text-white shadow-md shadow-blue-200'
                        : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
                    }`}
                    title={!sidebarOpen ? item.label : undefined}
                  >
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    {sidebarOpen && (
                      <div className="text-left min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate">{item.label}</p>
                        <p className={`text-xs leading-tight truncate ${active ? 'text-blue-200' : 'text-gray-400'}`}>{item.description}</p>
                      </div>
                    )}
                    {sidebarOpen && active && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70 flex-shrink-0"/>
                    )}
                  </button>
                )
              })}
            </nav>

            {/* Quick action at bottom */}
            {sidebarOpen && (
              <div className="px-4 pb-6 space-y-2 flex-shrink-0">
                <button onClick={() => setShowAddIntern(true)}
                  className="w-full py-2.5 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white rounded-xl text-xs font-bold hover:shadow-md transition-all flex items-center justify-center gap-2">
                  + Add New Intern
                </button>
                <button onClick={() => setShowAddAttendance(true)}
                  className="w-full py-2 border-2 border-green-300 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-50 transition-all flex items-center justify-center gap-2">
                  ✓ Log Attendance
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main Content ──────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ══ OVERVIEW ══════════════════════════════════════════════════════════ */}
          {activeSection === 'overview' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-display font-bold text-2xl text-gray-800">Intern Overview</h1>
                  <p className="text-sm text-gray-500 mt-0.5">Summary of all internship activity at DTC Region V</p>
                </div>
                <button onClick={() => setShowAddIntern(true)}
                  className="px-4 py-2 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                  + Add Intern
                </button>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Interns', value: interns.length, icon: '👥', color: 'from-blue-500 to-indigo-600', sub: `${activeInterns.length} active` },
                  { label: 'Hours Logged', value: `${Math.round(totalHoursLogged)}h`, icon: '⏱️', color: 'from-green-500 to-emerald-600', sub: 'across all interns' },
                  { label: 'Pending Tasks', value: pendingTasksCount, icon: '✅', color: 'from-purple-500 to-purple-700', sub: 'need attention' },
                  { label: "Today's Present", value: todayAttendance.filter(a => a.status === 'PRESENT').length, icon: '📅', color: 'from-orange-500 to-red-500', sub: `of ${activeInterns.length} active` },
                ].map(c => (
                  <div key={c.label} className="glass rounded-2xl p-5 shadow-sm">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-xl mb-3 shadow-md`}>{c.icon}</div>
                    <p className="text-2xl font-display font-bold text-gray-800">{c.value}</p>
                    <p className="text-sm font-semibold text-gray-700 mt-0.5">{c.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
                  </div>
                ))}
              </div>

              {/* Active interns list */}
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-semibold text-gray-800 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-green-100 text-green-600 flex items-center justify-center text-sm">👥</span>
                    Active Interns
                  </h2>
                  <button onClick={() => setActiveSection('interns')} className="text-xs text-[var(--dict-blue)] hover:underline font-semibold">View all →</button>
                </div>
                {loading ? (
                  <div className="flex items-center justify-center py-12"><Spinner/></div>
                ) : activeInterns.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-4xl mb-3">👥</p>
                    <p className="text-gray-500 font-medium">No active interns yet</p>
                    <button onClick={() => setShowAddIntern(true)} className="mt-3 text-sm text-[var(--dict-blue)] hover:underline font-semibold">+ Add the first intern</button>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {activeInterns.map(intern => {
                      const daysLeft = differenceInDays(new Date(intern.endDate), new Date())
                      return (
                        <div key={intern.id}
                          className="p-4 rounded-xl border-2 border-gray-100 hover:border-[var(--dict-blue)] hover:bg-blue-50/50 transition-all cursor-pointer"
                          onClick={() => { setSelectedIntern(intern); setActiveSection('interns') }}>
                          <div className="flex items-center gap-3 mb-3">
                            <Avatar name={intern.fullName} photo={intern.photoUrl} size="md"/>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-sm text-gray-800 truncate">{intern.fullName}</p>
                              <p className="text-xs text-gray-500 truncate">{intern.course} · {intern.school}</p>
                            </div>
                          </div>
                          <HoursProgress current={intern.totalHours} required={intern.requiredHours}/>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-400">{daysLeft > 0 ? `${daysLeft} days left` : 'Ended'}</span>
                            <span className="text-xs text-gray-400">{intern.tasks.filter(t => t.status === 'PENDING').length} pending tasks</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Recent attendance & tasks side by side */}
              <div className="grid md:grid-cols-2 gap-5">
                {/* Today's attendance */}
                <div className="glass rounded-2xl p-5">
                  <h2 className="font-display font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-sm">📅</span>
                    Today's Attendance
                  </h2>
                  {todayAttendance.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-2xl mb-2">📅</p>
                      <p className="text-sm text-gray-400">No records for today</p>
                      <button onClick={() => setShowAddAttendance(true)} className="mt-2 text-xs text-green-600 hover:underline font-semibold">+ Log attendance</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {todayAttendance.map(a => {
                        const m = ATTENDANCE_STATUS_META[a.status as AttendanceStatus]
                        return (
                          <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${m.color}`}>{m.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-700 truncate">{(a as any).internName}</p>
                              {a.timeIn && <p className="text-xs text-gray-400">{format(new Date(a.timeIn), 'h:mm a')} {a.timeOut ? `– ${format(new Date(a.timeOut), 'h:mm a')}` : '(ongoing)'}</p>}
                            </div>
                            {a.hours && <span className="text-xs font-bold text-gray-600">{a.hours}h</span>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Pending tasks */}
                <div className="glass rounded-2xl p-5">
                  <h2 className="font-display font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-sm">✅</span>
                    Pending Tasks
                  </h2>
                  {allTasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-2xl mb-2">✅</p>
                      <p className="text-sm text-gray-400">All tasks completed!</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {allTasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').slice(0, 8).map(t => {
                        const pm = PRIORITY_META[t.priority] || PRIORITY_META.MEDIUM
                        const tm = TASK_STATUS_META[t.status as TaskStatus]
                        return (
                          <div key={t.id} className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                            <span className="text-sm mt-0.5">{tm.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-700 truncate">{t.title}</p>
                              <p className="text-xs text-gray-400">{(t as any).internName}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${pm.color}`}>{pm.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══ INTERNS ROSTER ════════════════════════════════════════════════════ */}
          {activeSection === 'interns' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="font-display font-bold text-2xl text-gray-800">Intern Roster</h1>
                  <p className="text-sm text-gray-500 mt-0.5">{interns.length} total intern{interns.length !== 1 ? 's' : ''} on record</p>
                </div>
                <button onClick={() => setShowAddIntern(true)}
                  className="px-4 py-2 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                  + Add Intern
                </button>
              </div>

              {/* Filters */}
              <div className="glass rounded-2xl p-3 flex flex-wrap gap-2 items-center">
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name, school, or course..."
                  className="flex-1 min-w-[200px] border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--dict-blue)]"/>
                <div className="flex gap-2">
                  {['all', 'ACTIVE', 'COMPLETED', 'INACTIVE', 'ON_LEAVE'].map(s => (
                    <button key={s} onClick={() => setFilterStatus(s)}
                      className={`text-xs px-3 py-2 rounded-xl font-semibold transition-all ${filterStatus === s ? 'bg-[var(--dict-blue)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {s === 'all' ? 'All' : INTERN_STATUS_META[s as InternStatus].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Intern selected detail view */}
              {selectedIntern ? (
                <div className="glass rounded-2xl overflow-hidden">
                  <div className="bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 p-6 text-white">
                    <button onClick={() => setSelectedIntern(null)} className="text-xs text-blue-200 hover:text-white mb-4 flex items-center gap-1">← Back to list</button>
                    <div className="flex items-start gap-4">
                      <Avatar name={selectedIntern.fullName} photo={selectedIntern.photoUrl} size="xl"/>
                      <div className="flex-1">
                        <h2 className="font-display font-bold text-2xl">{selectedIntern.fullName}</h2>
                        <p className="text-blue-200 mt-1">{selectedIntern.course} · {selectedIntern.school}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${INTERN_STATUS_META[selectedIntern.status].badge}`}>{INTERN_STATUS_META[selectedIntern.status].label}</span>
                          {selectedIntern.department && <span className="text-xs px-3 py-1 rounded-full bg-white/20 text-white font-semibold">{selectedIntern.department}</span>}
                          {selectedIntern.supervisor && <span className="text-xs px-3 py-1 rounded-full bg-white/20 text-white font-semibold">👤 {selectedIntern.supervisor}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <select value={selectedIntern.status} onChange={e => handleStatusChange(selectedIntern.id, e.target.value as InternStatus)}
                          className="text-xs px-3 py-2 rounded-xl bg-white/20 text-white border border-white/30 outline-none cursor-pointer">
                          {Object.entries(INTERN_STATUS_META).map(([k, v]) => <option key={k} value={k} className="text-gray-800">{v.label}</option>)}
                        </select>
                        <button onClick={() => handleDeleteIntern(selectedIntern.id)}
                          className="text-xs px-3 py-2 rounded-xl bg-red-500/30 text-white border border-red-400/40 hover:bg-red-500/50 transition-all">
                          🗑 Delete
                        </button>
                      </div>
                    </div>
                    <div className="mt-5">
                      <HoursProgress current={selectedIntern.totalHours} required={selectedIntern.requiredHours}/>
                    </div>
                  </div>

                  <div className="p-6 grid md:grid-cols-3 gap-4">
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">📋 Internship Details</h3>
                      {[
                        { label: 'Start Date', value: format(new Date(selectedIntern.startDate), 'MMM d, yyyy') },
                        { label: 'End Date', value: format(new Date(selectedIntern.endDate), 'MMM d, yyyy') },
                        { label: 'Required Hours', value: `${selectedIntern.requiredHours}h` },
                        { label: 'Logged Hours', value: `${Math.round(selectedIntern.totalHours)}h` },
                        { label: 'Remaining', value: `${Math.max(0, selectedIntern.requiredHours - Math.round(selectedIntern.totalHours))}h` },
                      ].map(item => (
                        <div key={item.label} className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                          <span className="text-gray-500">{item.label}</span>
                          <span className="font-semibold text-gray-800">{item.value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">📞 Contact Information</h3>
                      {[
                        { label: 'Email', value: selectedIntern.email || 'Not provided' },
                        { label: 'Phone', value: selectedIntern.phone || 'Not provided' },
                      ].map(item => (
                        <div key={item.label} className="text-sm border-b border-gray-100 pb-2">
                          <p className="text-gray-500 text-xs">{item.label}</p>
                          <p className="font-semibold text-gray-800 mt-0.5">{item.value}</p>
                        </div>
                      ))}
                      {selectedIntern.notes && (
                        <div className="text-sm">
                          <p className="text-gray-500 text-xs">Notes</p>
                          <p className="text-gray-700 mt-0.5 text-xs leading-relaxed">{selectedIntern.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-gray-700">📊 Quick Stats</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Days Present', value: selectedIntern.attendance.filter(a => a.status === 'PRESENT' || a.status === 'HALF_DAY').length, color: 'bg-green-50 text-green-700' },
                          { label: 'Days Absent', value: selectedIntern.attendance.filter(a => a.status === 'ABSENT').length, color: 'bg-red-50 text-red-700' },
                          { label: 'Tasks Done', value: selectedIntern.tasks.filter(t => t.status === 'COMPLETED').length, color: 'bg-blue-50 text-blue-700' },
                          { label: 'Pending Tasks', value: selectedIntern.tasks.filter(t => t.status === 'PENDING').length, color: 'bg-yellow-50 text-yellow-700' },
                        ].map(s => (
                          <div key={s.label} className={`p-3 rounded-xl ${s.color}`}>
                            <p className="text-2xl font-bold">{s.value}</p>
                            <p className="text-xs font-semibold mt-0.5">{s.label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => { setNewAttendance(f => ({ ...f, internId: selectedIntern.id })); setShowAddAttendance(true) }}
                          className="flex-1 py-2 bg-green-500 text-white rounded-xl text-xs font-bold hover:bg-green-600 transition-all">
                          + Log DTR
                        </button>
                        <button onClick={() => { setNewTask(f => ({ ...f, internId: selectedIntern.id })); setShowAddTask(true) }}
                          className="flex-1 py-2 bg-purple-500 text-white rounded-xl text-xs font-bold hover:bg-purple-600 transition-all">
                          + Assign Task
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Recent attendance */}
                  <div className="px-6 pb-6">
                    <h3 className="text-sm font-bold text-gray-700 mb-3">Recent Attendance Records</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b-2 border-gray-100">
                            <th className="text-left text-xs font-semibold text-gray-500 pb-2">Date</th>
                            <th className="text-left text-xs font-semibold text-gray-500 pb-2">Time In</th>
                            <th className="text-left text-xs font-semibold text-gray-500 pb-2">Time Out</th>
                            <th className="text-left text-xs font-semibold text-gray-500 pb-2">Hours</th>
                            <th className="text-left text-xs font-semibold text-gray-500 pb-2">Status</th>
                            <th className="text-xs font-semibold text-gray-500 pb-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedIntern.attendance.slice(0, 10).map(a => {
                            const m = ATTENDANCE_STATUS_META[a.status as AttendanceStatus]
                            return (
                              <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                <td className="py-2 text-gray-700 font-medium">{format(new Date(a.date), 'MMM d, yyyy')}</td>
                                <td className="py-2 text-gray-500 font-mono text-xs">{a.timeIn ? format(new Date(a.timeIn), 'h:mm a') : '—'}</td>
                                <td className="py-2 text-gray-500 font-mono text-xs">{a.timeOut ? format(new Date(a.timeOut), 'h:mm a') : '—'}</td>
                                <td className="py-2 font-bold text-gray-800">{a.hours ? `${a.hours}h` : '—'}</td>
                                <td className="py-2">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${m.color}`}>{m.label}</span>
                                </td>
                                <td className="py-2 text-right">
                                  <button onClick={() => handleDeleteAttendance(selectedIntern.id, a.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {selectedIntern.attendance.length === 0 && (
                        <p className="text-center text-gray-400 text-sm py-6">No attendance records yet</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Intern list — table view */
                <div className="glass rounded-2xl overflow-hidden">
                  {loading ? (
                    <div className="flex items-center justify-center py-16"><Spinner/></div>
                  ) : filteredInterns.length === 0 ? (
                    <div className="py-16 text-center">
                      <p className="text-5xl mb-4">👥</p>
                      <p className="text-gray-500 font-medium text-lg">No interns found</p>
                      <button onClick={() => setShowAddIntern(true)} className="mt-4 px-6 py-2.5 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white rounded-xl text-sm font-bold">+ Add First Intern</button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b-2 border-gray-100">
                            <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3">Intern</th>
                            <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3">School / Course</th>
                            <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3">Start Date</th>
                            <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3">End Date</th>
                            <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3 min-w-[160px]">Hours Progress</th>
                            <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3">Status</th>
                            <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3">Days Left</th>
                            <th className="text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {filteredInterns.map(intern => {
                            const sm = INTERN_STATUS_META[intern.status]
                            const daysLeft = differenceInDays(new Date(intern.endDate), new Date())
                            const pct = Math.min(100, Math.round((intern.totalHours / intern.requiredHours) * 100))
                            const barColor = pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-blue-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-400'
                            return (
                              <tr key={intern.id}
                                className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                                onClick={() => setSelectedIntern(intern)}>
                                {/* Name + avatar */}
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <Avatar name={intern.fullName} photo={intern.photoUrl} size="sm"/>
                                    <div className="min-w-0">
                                      <p className="font-bold text-sm text-gray-800 truncate max-w-[140px]">{intern.fullName}</p>
                                      {intern.supervisor && <p className="text-xs text-gray-400 truncate">👤 {intern.supervisor}</p>}
                                    </div>
                                  </div>
                                </td>
                                {/* School / course */}
                                <td className="px-4 py-3">
                                  <p className="text-sm font-semibold text-gray-700 truncate max-w-[160px]">{intern.school}</p>
                                  <p className="text-xs text-gray-400 truncate">{intern.course}</p>
                                </td>
                                {/* Start date */}
                                <td className="px-4 py-3">
                                  <p className="text-sm font-semibold text-gray-700">{format(new Date(intern.startDate), 'MMM d, yyyy')}</p>
                                  <p className="text-xs text-gray-400">{format(new Date(intern.startDate), 'EEEE')}</p>
                                </td>
                                {/* End date */}
                                <td className="px-4 py-3">
                                  <p className="text-sm font-semibold text-gray-700">{format(new Date(intern.endDate), 'MMM d, yyyy')}</p>
                                  <p className="text-xs text-gray-400">{format(new Date(intern.endDate), 'EEEE')}</p>
                                </td>
                                {/* Hours progress */}
                                <td className="px-4 py-3 min-w-[160px]">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-gray-500">{Math.round(intern.totalHours)}h / {intern.requiredHours}h</span>
                                    <span className={`text-xs font-bold ${pct >= 100 ? 'text-green-600' : pct >= 70 ? 'text-blue-600' : 'text-orange-600'}`}>{pct}%</span>
                                  </div>
                                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }}/>
                                  </div>
                                </td>
                                {/* Status */}
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sm.dot}`}/>
                                    <span className={`text-xs px-2 py-1 rounded-full border font-semibold whitespace-nowrap ${sm.badge}`}>{sm.label}</span>
                                  </div>
                                </td>
                                {/* Days left */}
                                <td className="px-4 py-3">
                                  {daysLeft > 30 ? (
                                    <span className="text-sm font-bold text-gray-700">{daysLeft}d</span>
                                  ) : daysLeft > 7 ? (
                                    <span className="text-sm font-bold text-orange-600">{daysLeft}d</span>
                                  ) : daysLeft > 0 ? (
                                    <span className="text-sm font-bold text-red-600 animate-pulse">{daysLeft}d left!</span>
                                  ) : daysLeft === 0 ? (
                                    <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Last day!</span>
                                  ) : (
                                    <span className="text-xs text-gray-400">{Math.abs(daysLeft)}d ago</span>
                                  )}
                                </td>
                                {/* Actions */}
                                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => { setNewAttendance(f => ({ ...f, internId: intern.id })); setShowAddAttendance(true) }}
                                      title="Log attendance"
                                      className="w-7 h-7 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 flex items-center justify-center text-xs font-bold transition-all">
                                      ✓
                                    </button>
                                    <button
                                      onClick={() => { setNewTask(f => ({ ...f, internId: intern.id })); setShowAddTask(true) }}
                                      title="Assign task"
                                      className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 flex items-center justify-center text-xs transition-all">
                                      +
                                    </button>
                                    <button
                                      onClick={() => setSelectedIntern(intern)}
                                      title="View profile"
                                      className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center justify-center text-xs transition-all">
                                      →
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                        Showing {filteredInterns.length} of {interns.length} interns · Click any row to view full profile
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══ ATTENDANCE/DTR ════════════════════════════════════════════════════ */}
          {activeSection === 'attendance' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="font-display font-bold text-2xl text-gray-800">Attendance / DTR</h1>
                  <p className="text-sm text-gray-500 mt-0.5">Daily time records for all interns</p>
                </div>
                <button onClick={() => setShowAddAttendance(true)}
                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                  ✓ Log Attendance
                </button>
              </div>

              {activeInterns.map(intern => {
                const recentRecords = intern.attendance.slice(0, 14)
                const weekHours = intern.attendance.filter(a => {
                  const d = new Date(a.date)
                  const now = new Date()
                  const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
                  return diff <= 7
                }).reduce((s, a) => s + (a.hours ?? 0), 0)

                return (
                  <div key={intern.id} className="glass rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <Avatar name={intern.fullName} photo={intern.photoUrl} size="sm"/>
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{intern.fullName}</p>
                          <p className="text-xs text-gray-500">{intern.course} · {intern.school}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className="text-xs text-gray-400">This week</p>
                          <p className="font-bold text-gray-700 text-sm">{Math.round(weekHours * 10) / 10}h</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Total</p>
                          <p className="font-bold text-[var(--dict-blue)] text-sm">{Math.round(intern.totalHours * 10) / 10}h / {intern.requiredHours}h</p>
                        </div>
                        <button onClick={() => { setNewAttendance(f => ({ ...f, internId: intern.id })); setShowAddAttendance(true) }}
                          className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-200 transition-all">
                          + Log
                        </button>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="mb-3">
                        <HoursProgress current={intern.totalHours} required={intern.requiredHours}/>
                      </div>
                      {recentRecords.length === 0 ? (
                        <p className="text-center text-gray-400 text-xs py-4">No attendance records yet</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                          {recentRecords.map(a => {
                            const m = ATTENDANCE_STATUS_META[a.status as AttendanceStatus]
                            return (
                              <div key={a.id} className={`rounded-xl p-2.5 border text-center group relative ${m.color} border-current/20`}>
                                <p className="text-xs font-bold">{format(new Date(a.date), 'MMM d')}</p>
                                <p className="text-lg mt-0.5">{m.icon}</p>
                                {a.hours && <p className="text-xs font-semibold mt-0.5">{a.hours}h</p>}
                                <button
                                  onClick={() => handleDeleteAttendance(intern.id, a.id)}
                                  className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs hidden group-hover:flex items-center justify-center">
                                  ✕
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {activeInterns.length === 0 && (
                <div className="glass rounded-2xl py-16 text-center">
                  <p className="text-5xl mb-4">📅</p>
                  <p className="text-gray-500 font-medium">No active interns to show attendance for</p>
                </div>
              )}
            </div>
          )}

          {/* ══ TASKS ════════════════════════════════════════════════════════════ */}
          {activeSection === 'tasks' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="font-display font-bold text-2xl text-gray-800">Task Management</h1>
                  <p className="text-sm text-gray-500 mt-0.5">{allTasks.length} total tasks across all interns</p>
                </div>
                <button onClick={() => setShowAddTask(true)}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                  + Assign Task
                </button>
              </div>

              {/* Kanban columns */}
              <div className="grid md:grid-cols-4 gap-4">
                {(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as TaskStatus[]).map(status => {
                  const statusTasks = allTasks.filter(t => t.status === status)
                  const tm = TASK_STATUS_META[status]
                  return (
                    <div key={status} className="glass rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                          <span>{tm.icon}</span>{tm.label}
                        </h3>
                        <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-bold">{statusTasks.length}</span>
                      </div>
                      <div className="space-y-2 min-h-[100px]">
                        {statusTasks.map(task => {
                          const pm = PRIORITY_META[task.priority] || PRIORITY_META.MEDIUM
                          const intern = interns.find(i => i.id === task.internId)
                          return (
                            <div key={task.id} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm hover:shadow-md transition-all">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <p className="text-sm font-semibold text-gray-800 leading-tight">{task.title}</p>
                                <button onClick={() => handleDeleteTask(task.internId, task.id)} className="text-red-300 hover:text-red-500 text-xs flex-shrink-0">✕</button>
                              </div>
                              {task.description && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${pm.color}`}>{pm.label}</span>
                                {task.dueDate && (
                                  <span className="text-xs text-gray-400">Due {format(new Date(task.dueDate), 'MMM d')}</span>
                                )}
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                {intern && (
                                  <div className="flex items-center gap-1.5">
                                    <Avatar name={intern.fullName} photo={intern.photoUrl} size="sm"/>
                                    <span className="text-xs text-gray-500 truncate max-w-[80px]">{intern.fullName.split(' ')[0]}</span>
                                  </div>
                                )}
                                <select value={task.status} onChange={e => handleTaskStatusChange(task.internId, task.id, e.target.value as TaskStatus)}
                                  className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 outline-none text-gray-600 cursor-pointer">
                                  {Object.entries(TASK_STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                              </div>
                            </div>
                          )
                        })}
                        {statusTasks.length === 0 && (
                          <p className="text-center text-xs text-gray-300 py-4">No tasks</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ══ DOCUMENTS ════════════════════════════════════════════════════════ */}
          {activeSection === 'documents' && (
            <div className="space-y-5">
              <div>
                <h1 className="font-display font-bold text-2xl text-gray-800">Documents</h1>
                <p className="text-sm text-gray-500 mt-0.5">Organize and manage intern files and records</p>
              </div>

              {/* Document categories info */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: '📄', label: 'MOA / Endorsement', desc: 'Memorandum of Agreement, school endorsement letters', color: 'from-blue-500 to-indigo-500' },
                  { icon: '🪪', label: 'ID & Identification', desc: 'Government IDs, school IDs', color: 'from-green-500 to-teal-500' },
                  { icon: '📝', label: 'Reports & Output', desc: 'Weekly reports, project deliverables', color: 'from-purple-500 to-violet-500' },
                  { icon: '📋', label: 'Assessment Forms', desc: 'Performance evaluation, completion forms', color: 'from-orange-500 to-red-500' },
                ].map(cat => (
                  <div key={cat.label} className="glass rounded-2xl p-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center text-xl mb-3 shadow-md`}>{cat.icon}</div>
                    <p className="font-bold text-sm text-gray-800">{cat.label}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{cat.desc}</p>
                  </div>
                ))}
              </div>

              {/* Per-intern document list */}
              {interns.map(intern => (
                intern.documents.length > 0 && (
                  <div key={intern.id} className="glass rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar name={intern.fullName} photo={intern.photoUrl} size="sm"/>
                      <h3 className="font-bold text-gray-800">{intern.fullName}</h3>
                      <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{intern.documents.length} file{intern.documents.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {intern.documents.map(doc => (
                        <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-100 hover:border-[var(--dict-blue)] hover:bg-blue-50/50 transition-all">
                          <span className="text-2xl">📄</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-800 truncate">{doc.name}</p>
                            <p className="text-xs text-gray-400">{doc.type} · {format(new Date(doc.createdAt), 'MMM d, yyyy')}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )
              ))}

              <div className="glass rounded-2xl p-8 text-center border-2 border-dashed border-gray-200">
                <p className="text-4xl mb-3">📁</p>
                <p className="text-gray-600 font-semibold">Document Upload Coming Soon</p>
                <p className="text-sm text-gray-400 mt-1">You'll be able to upload and organize intern files here</p>
              </div>
            </div>
          )}

          {/* ══ REPORTS ══════════════════════════════════════════════════════════ */}
          {activeSection === 'reports' && (
            <div className="space-y-5">
              <div>
                <h1 className="font-display font-bold text-2xl text-gray-800">Reports & Analytics</h1>
                <p className="text-sm text-gray-500 mt-0.5">Internship program performance and summaries</p>
              </div>

              {/* Summary stats */}
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { label: 'Completion Rate', value: interns.length > 0 ? `${Math.round((interns.filter(i => i.status === 'COMPLETED').length / interns.length) * 100)}%` : '0%', icon: '🎓', desc: `${interns.filter(i => i.status === 'COMPLETED').length} completed internships` },
                  { label: 'Avg. Hours Logged', value: interns.length > 0 ? `${Math.round(totalHoursLogged / interns.length)}h` : '0h', icon: '⏱️', desc: 'Per intern average' },
                  { label: 'Task Completion', value: allTasks.length > 0 ? `${Math.round((allTasks.filter(t => t.status === 'COMPLETED').length / allTasks.length) * 100)}%` : 'N/A', icon: '✅', desc: `${allTasks.filter(t => t.status === 'COMPLETED').length} of ${allTasks.length} tasks done` },
                ].map(s => (
                  <div key={s.label} className="glass rounded-2xl p-5">
                    <span className="text-3xl">{s.icon}</span>
                    <p className="text-3xl font-display font-bold text-gray-800 mt-2">{s.value}</p>
                    <p className="font-semibold text-gray-700 mt-0.5">{s.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                  </div>
                ))}
              </div>

              {/* Per-intern report */}
              <div className="glass rounded-2xl p-5">
                <h2 className="font-display font-semibold text-gray-800 mb-4">Individual Intern Reports</h2>
                <div className="space-y-3">
                  {interns.map(intern => {
                    const sm = INTERN_STATUS_META[intern.status]
                    const tasksDone = intern.tasks.filter(t => t.status === 'COMPLETED').length
                    const daysPresent = intern.attendance.filter(a => a.status === 'PRESENT' || a.status === 'HALF_DAY').length
                    const daysLeft = differenceInDays(new Date(intern.endDate), new Date())
                    return (
                      <div key={intern.id} className="p-4 rounded-xl border-2 border-gray-100 hover:bg-gray-50 transition-all">
                        <div className="flex items-center gap-4">
                          <Avatar name={intern.fullName} photo={intern.photoUrl} size="md"/>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="font-bold text-gray-800">{intern.fullName}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${sm.badge}`}>{sm.label}</span>
                            </div>
                            <p className="text-xs text-gray-500">{intern.course} · {intern.school}</p>
                            <div className="mt-2">
                              <HoursProgress current={intern.totalHours} required={intern.requiredHours}/>
                            </div>
                          </div>
                          <div className="hidden sm:grid grid-cols-3 gap-4 text-center flex-shrink-0">
                            <div>
                              <p className="text-lg font-bold text-gray-800">{daysPresent}</p>
                              <p className="text-xs text-gray-400">Days</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold text-gray-800">{tasksDone}/{intern.tasks.length}</p>
                              <p className="text-xs text-gray-400">Tasks</p>
                            </div>
                            <div>
                              <p className={`text-lg font-bold ${daysLeft > 0 ? 'text-gray-800' : 'text-red-600'}`}>{Math.abs(daysLeft)}{daysLeft < 0 ? ' ago' : 'd'}</p>
                              <p className="text-xs text-gray-400">{daysLeft < 0 ? 'Ended' : 'Left'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {interns.length === 0 && (
                    <p className="text-center text-gray-400 py-8">No intern data available</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
