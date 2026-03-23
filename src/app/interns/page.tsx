'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { GovSeal, GovHeaderLogos } from '@/components/GovernmentHeader'
import { format, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isSameMonth, isToday, parseISO } from 'date-fns'
import * as XLSX from 'xlsx'

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

type NavSection = 'overview' | 'interns' | 'attendance' | 'tasks' | 'calendar' | 'timeline' | 'documents' | 'certificates' | 'reports'

const NAV_ITEMS: { id: NavSection; label: string; icon: string; description: string }[] = [
  { id: 'overview',     label: 'Overview',       icon: '📊', description: 'Dashboard & stats' },
  { id: 'interns',      label: 'Intern Roster',  icon: '👥', description: 'Manage interns' },
  { id: 'attendance',   label: 'Attendance/DTR', icon: '📅', description: 'Time records' },
  { id: 'tasks',        label: 'Tasks',          icon: '✅', description: 'Assign & track' },
  { id: 'calendar',     label: 'Calendar',       icon: '🗓️', description: 'Events & due dates' },
  { id: 'timeline',     label: 'Timeline',       icon: '⏳', description: 'Intern progress gallery' },
  { id: 'documents',    label: 'Documents',      icon: '📁', description: 'Files & records' },
  { id: 'certificates', label: 'Certificates',   icon: '📜', description: 'Generate certificates' },
  { id: 'reports',      label: 'Reports',        icon: '📈', description: 'Summaries' },
]

// ─── School colour palette ────────────────────────────────────────────────────
const SCHOOL_PALETTE = [
  { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500',   ring: 'ring-blue-200',   grad: 'from-blue-500 to-indigo-600',   light: 'bg-blue-50',   border: 'border-blue-200'   },
  { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', ring: 'ring-purple-200', grad: 'from-purple-500 to-purple-700', light: 'bg-purple-50', border: 'border-purple-200' },
  { bg: 'bg-emerald-100',text: 'text-emerald-700',dot: 'bg-emerald-500',ring: 'ring-emerald-200',grad: 'from-emerald-500 to-green-600',  light: 'bg-emerald-50',border: 'border-emerald-200'},
  { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500', ring: 'ring-orange-200', grad: 'from-orange-500 to-amber-500',  light: 'bg-orange-50', border: 'border-orange-200' },
  { bg: 'bg-rose-100',   text: 'text-rose-700',   dot: 'bg-rose-500',   ring: 'ring-rose-200',   grad: 'from-rose-500 to-pink-600',    light: 'bg-rose-50',   border: 'border-rose-200'   },
  { bg: 'bg-teal-100',   text: 'text-teal-700',   dot: 'bg-teal-500',   ring: 'ring-teal-200',   grad: 'from-teal-500 to-cyan-600',    light: 'bg-teal-50',   border: 'border-teal-200'   },
  { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500', ring: 'ring-indigo-200', grad: 'from-indigo-500 to-blue-600',  light: 'bg-indigo-50', border: 'border-indigo-200' },
  { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500',  ring: 'ring-amber-200',  grad: 'from-amber-500 to-yellow-500', light: 'bg-amber-50',  border: 'border-amber-200'  },
  { bg: 'bg-cyan-100',   text: 'text-cyan-700',   dot: 'bg-cyan-500',   ring: 'ring-cyan-200',   grad: 'from-cyan-500 to-sky-600',     light: 'bg-cyan-50',   border: 'border-cyan-200'   },
  { bg: 'bg-fuchsia-100',text: 'text-fuchsia-700',dot: 'bg-fuchsia-500',ring: 'ring-fuchsia-200',grad: 'from-fuchsia-500 to-pink-600', light: 'bg-fuchsia-50',border: 'border-fuchsia-200'},
]
function getSchoolColor(school: string) {
  let hash = 0
  for (let i = 0; i < school.length; i++) hash = (school.charCodeAt(i) + ((hash << 5) - hash)) | 0
  return SCHOOL_PALETTE[Math.abs(hash) % SCHOOL_PALETTE.length]
}

// ─── ICT Department badges ──────────────────────────────────────────────────
const DEPT_META: { key: string; label: string; short: string; color: string; icon: string }[] = [
  { key: 'miss',         label: 'Management Information Systems',  short: 'MIS/S',        color: 'bg-sky-100 text-sky-700 border-sky-300',          icon: '🖥️' },
  { key: 'cyber',        label: 'Cybersecurity',                   short: 'Cybersec',     color: 'bg-red-100 text-red-700 border-red-300',           icon: '🔒' },
  { key: 'gdtb',         label: 'Geospatial Data & Tech Branch',  short: 'GDTB',         color: 'bg-green-100 text-green-700 border-green-300',     icon: '🗺️' },
  { key: 'imb',          label: 'Information Management Branch',  short: 'IMB',          color: 'bg-purple-100 text-purple-700 border-purple-300',  icon: '📊' },
  { key: 'graphic',      label: 'Graphic Design / Multimedia',    short: 'Graphic',      color: 'bg-pink-100 text-pink-700 border-pink-300',        icon: '🎨' },
  { key: 'web',          label: 'Web Development',                short: 'Web Dev',      color: 'bg-indigo-100 text-indigo-700 border-indigo-300',  icon: '🌐' },
  { key: 'network',      label: 'Network Engineering',            short: 'Network',      color: 'bg-orange-100 text-orange-700 border-orange-300',  icon: '📡' },
  { key: 'database',     label: 'Database Administration',        short: 'DBA',          color: 'bg-teal-100 text-teal-700 border-teal-300',        icon: '🗄️' },
]
function getDeptBadge(intern: { department?: string | null; course?: string }) {
  const haystack = ((intern.department || '') + ' ' + (intern.course || '')).toLowerCase()
  return DEPT_META.find(d => haystack.includes(d.key)) || null
}

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
  const { status } = useSession()
  const clerkLoaded = status !== 'loading'
  const isSignedIn  = status === 'authenticated'
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
  const [opError, setOpError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [draggedTask, setDraggedTask] = useState<{ taskId: string; internId: string; fromStatus: TaskStatus } | null>(null)
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null)
  const [dtrIntern, setDtrIntern] = useState<string>('all')
  const [internPhotoPreview, setInternPhotoPreview] = useState<string | null>(null)
  const [internDocFiles, setInternDocFiles] = useState<{ name: string; type: string; data: string }[]>([])
  const [showEditIntern, setShowEditIntern] = useState(false)
  const [editInternData, setEditInternData] = useState({ fullName: '', school: '', course: '', department: '', supervisor: '', startDate: '', endDate: '', requiredHours: '', email: '', phone: '', notes: '', status: 'ACTIVE' as InternStatus })
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailTarget, setEmailTarget] = useState<Intern | null>(null)
  const [emailData, setEmailData] = useState({ subject: '', message: '', type: 'general', senderName: 'DTC Supervisor' })
  const [emailSending, setEmailSending] = useState(false)
  const [emailResult, setEmailResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [calendarSelectedDay, setCalendarSelectedDay] = useState<Date | null>(null)
  const [filterSchool, setFilterSchool] = useState<string>('all')
  // Time In/Out live timers: internId → { startTime, intervalId }
  const [activeClockIn, setActiveClockIn] = useState<Record<string, { startTime: Date; display: string }>>({}) 
  const [taskInternFilter, setTaskInternFilter] = useState<string>('all')

  // ─── Data Fetching ────────────────────────────────────────────────────────────
  const fetchInterns = useCallback(async () => {
    try {
      const r = await fetch('/api/interns')
      if (r.ok) {
        const data = await r.json()
        setInterns(data)
        // Sync selected intern without creating a dependency cycle
        setSelectedIntern(prev => {
          if (!prev) return null
          return data.find((i: Intern) => i.id === prev.id) ?? prev
        })
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!isSignedIn) return
    fetchInterns()
    // Keep intern data fresh every 60 s (attendance, tasks, status can change)
    const poll = setInterval(() => fetchInterns(), 60_000)
    return () => clearInterval(poll)
  }, [isSignedIn, fetchInterns])

  // Live clock tick for Time In/Out counter
  useEffect(() => {
    const id = setInterval(() => {
      setActiveClockIn(prev => {
        const next: typeof prev = {}
        let changed = false
        Object.entries(prev).forEach(([internId, entry]) => {
          const secs = Math.floor((Date.now() - entry.startTime.getTime()) / 1000)
          const h = String(Math.floor(secs / 3600)).padStart(2, '0')
          const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
          const s = String(secs % 60).padStart(2, '0')
          const display = `${h}:${m}:${s}`
          if (display !== entry.display) changed = true
          next[internId] = { ...entry, display }
        })
        return changed ? next : prev
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // ─── Derived data ─────────────────────────────────────────────────────────────
  const activeInterns = useMemo(() => interns.filter(i => i.status === 'ACTIVE'), [interns])
  const filteredInterns = useMemo(() => {
    let list = interns
    if (filterStatus !== 'all') list = list.filter(i => i.status === filterStatus)
    if (filterSchool !== 'all') list = list.filter(i => i.school === filterSchool)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(i =>
        i.fullName.toLowerCase().includes(q) ||
        i.school.toLowerCase().includes(q) ||
        i.course.toLowerCase().includes(q)
      )
    }
    return list
  }, [interns, filterStatus, filterSchool, searchQuery])

  const allTasks = useMemo(() => interns.flatMap(i => i.tasks.map(t => ({ ...t, internName: i.fullName, internPhoto: i.photoUrl }))), [interns])
  const pendingTasksCount = useMemo(() => allTasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length, [allTasks])

  const schoolGroups = useMemo(() => {
    const map = new Map<string, Intern[]>()
    interns.forEach(i => {
      if (!map.has(i.school)) map.set(i.school, [])
      map.get(i.school)!.push(i)
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [interns])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, typeof allTasks>()
    allTasks.forEach(t => {
      if (!t.dueDate) return
      const key = t.dueDate.split('T')[0]
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    })
    return map
  }, [allTasks])

  const attendanceByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>()
    interns.forEach(intern => {
      intern.attendance.forEach(a => {
        const key = a.date.split('T')[0]
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(a)
      })
    })
    return map
  }, [interns])

  const totalHoursLogged = useMemo(() => interns.reduce((s, i) => s + i.totalHours, 0), [interns])

  const todayAttendance = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    return interns.flatMap(i => i.attendance.filter(a => a.date.startsWith(today)).map(a => ({ ...a, internName: i.fullName })))
  }, [interns])

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  const handleInternPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setInternPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleDocFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        const docType = file.type.includes('pdf') ? 'PDF' : file.type.includes('image') ? 'Image' : 'Document'
        setInternDocFiles(prev => [...prev, { name: file.name, type: docType, data: reader.result as string }])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const handleDocFileRemove = (idx: number) => {
    setInternDocFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const handleAddIntern = async () => {
    if (!newIntern.fullName || !newIntern.school || !newIntern.course || !newIntern.startDate || !newIntern.endDate) return
    setSaving(true); setOpError(null)
    try {
      const r = await fetch('/api/interns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newIntern, photoUrl: internPhotoPreview || null })
      })
      if (!r.ok) { const d = await r.json().catch(()=>({})); setOpError(d.error || 'Failed to add intern.'); return }
      const intern = await r.json()
      for (const doc of internDocFiles) {
        await fetch(`/api/interns/${intern.id}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: doc.name, type: doc.type, url: doc.data })
        }).catch(() => {})
      }
      await fetchInterns()
      setShowAddIntern(false)
      setNewIntern({ fullName: '', school: '', course: '', department: '', supervisor: '', startDate: '', endDate: '', requiredHours: '486', email: '', phone: '', notes: '' })
      setInternPhotoPreview(null)
      setInternDocFiles([])
    } catch { setOpError('Network error — intern could not be added.') }
    finally { setSaving(false) }
  }

  const handleResendTask = async (internId: string, task: Task) => {
    try {
      await fetch(`/api/interns/${internId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: task.title, description: task.description, priority: task.priority, dueDate: task.dueDate })
      })
      fetchInterns()
    } catch { setOpError('Failed to re-assign task.') }
  }

  const handleStatusChange = async (internId: string, status: InternStatus) => {
    try {
      await fetch(`/api/interns/${internId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      fetchInterns()
    } catch { setOpError('Failed to update intern status.') }
  }

  const handleDeleteIntern = async (internId: string) => {
    if (!confirm('Delete this intern and all their records? This cannot be undone.')) return
    try {
      await fetch(`/api/interns/${internId}`, { method: 'DELETE' })
      if (selectedIntern?.id === internId) setSelectedIntern(null)
      fetchInterns()
    } catch { setOpError('Failed to delete intern.') }
  }

  const handleEditIntern = async () => {
    if (!selectedIntern) return
    setSaving(true); setOpError(null)
    try {
      const r = await fetch(`/api/interns/${selectedIntern.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editInternData,
          requiredHours: parseInt(editInternData.requiredHours) || 486,
          department: editInternData.department || null,
          supervisor: editInternData.supervisor || null,
          email: editInternData.email || null,
          phone: editInternData.phone || null,
          notes: editInternData.notes || null,
        })
      })
      if (!r.ok) { const d = await r.json().catch(()=>({})); setOpError(d.error || 'Failed to update intern.'); return }
      setShowEditIntern(false); await fetchInterns()
    } catch { setOpError('Network error — intern could not be updated.') }
    finally { setSaving(false) }
  }

  const handleSendEmail = async () => {
    if (!emailTarget || !emailData.subject || !emailData.message) return
    setEmailSending(true)
    setEmailResult(null)
    try {
      const r = await fetch(`/api/interns/${emailTarget.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      })
      const json = await r.json()
      if (r.ok) {
        setEmailResult({ ok: true, msg: `Email sent successfully to ${emailTarget.email}` })
        setEmailData({ subject: '', message: '', type: 'general', senderName: 'DTC Supervisor' })
      } else {
        setEmailResult({ ok: false, msg: json.error || 'Failed to send email' })
      }
    } catch { setEmailResult({ ok: false, msg: 'Network error — could not send email' }) }
    finally { setEmailSending(false) }
  }

  const handleAddAttendance = async () => {
    if (!newAttendance.internId) return
    // Block future dates
    if (newAttendance.date > format(new Date(), 'yyyy-MM-dd')) {
      setOpError('Cannot log attendance for a future date.')
      return
    }
    setSaving(true); setOpError(null)
    try {
      const date = newAttendance.date
      const timeIn = newAttendance.timeIn ? `${date}T${newAttendance.timeIn}:00` : null
      const timeOut = newAttendance.timeOut ? `${date}T${newAttendance.timeOut}:00` : null

      const r = await fetch(`/api/interns/${newAttendance.internId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, timeIn, timeOut, status: newAttendance.status, notes: newAttendance.notes })
      })
      if (!r.ok) { const d = await r.json().catch(()=>({})); setOpError(d.error || 'Failed to log attendance.'); return }
      await fetchInterns()
      setShowAddAttendance(false)
      setNewAttendance({ internId: '', date: format(new Date(), 'yyyy-MM-dd'), timeIn: '08:00', timeOut: '17:00', status: 'PRESENT', notes: '' })
    } catch { setOpError('Network error — attendance could not be saved.') }
    finally { setSaving(false) }
  }

  const handleAddTask = async () => {
    if (!newTask.internId || !newTask.title) return
    setSaving(true); setOpError(null)
    try {
      const r = await fetch(`/api/interns/${newTask.internId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      })
      if (!r.ok) { const d = await r.json().catch(()=>({})); setOpError(d.error || 'Failed to add task.'); return }
      await fetchInterns()
      setShowAddTask(false)
      setNewTask({ internId: '', title: '', description: '', priority: 'MEDIUM', dueDate: '' })
    } catch { setOpError('Network error — task could not be added.') }
    finally { setSaving(false) }
  }

  const handleTaskStatusChange = async (internId: string, taskId: string, status: TaskStatus) => {
    try {
      await fetch(`/api/interns/${internId}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status })
      })
      fetchInterns()
    } catch { setOpError('Failed to update task status.') }
  }

  const handleDeleteTask = async (internId: string, taskId: string) => {
    try {
      await fetch(`/api/interns/${internId}/tasks?taskId=${taskId}`, { method: 'DELETE' })
      fetchInterns()
    } catch { setOpError('Failed to delete task.') }
  }

  const handleDeleteAttendance = async (internId: string, recordId: string) => {
    try {
      await fetch(`/api/interns/${internId}/attendance?recordId=${recordId}`, { method: 'DELETE' })
      fetchInterns()
    } catch { setOpError('Failed to delete attendance record.') }
  }

  const exportDTR = (intern: Intern) => {
    const rows: (string | number)[][] = [
      ['DAILY TIME RECORD (DTR)'],
      ['Name:', intern.fullName],
      ['School:', intern.school],
      ['Course / Program:', intern.course],
      ['Department:', intern.department ?? ''],
      ['Supervisor:', intern.supervisor ?? ''],
      ['Internship Period:', `${format(new Date(intern.startDate), 'MMMM d, yyyy')} – ${format(new Date(intern.endDate), 'MMMM d, yyyy')}`],
      ['Required Hours:', intern.requiredHours],
      ['Total Hours Logged:', Math.round(intern.totalHours * 10) / 10],
      [],
      ['Date', 'Day', 'Time In', 'Time Out', 'Hours', 'Status', 'Notes'],
      ...intern.attendance
        .slice()
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(a => [
          format(new Date(a.date), 'MM/dd/yyyy'),
          format(new Date(a.date), 'EEEE'),
          a.timeIn ? format(new Date(a.timeIn), 'h:mm a') : '',
          a.timeOut ? format(new Date(a.timeOut), 'h:mm a') : '',
          a.hours ?? '',
          ATTENDANCE_STATUS_META[a.status as AttendanceStatus].label,
          a.notes ?? ''
        ])
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 30 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'DTR')
    XLSX.writeFile(wb, `DTR-${intern.fullName.replace(/\s+/g, '-')}.xlsx`)
  }

  const exportAllDTR = () => {
    const wb = XLSX.utils.book_new()
    interns.forEach(intern => {
      const rows: (string | number)[][] = [
        ['Name:', intern.fullName],
        ['School:', intern.school],
        ['Course:', intern.course],
        ['Period:', `${format(new Date(intern.startDate), 'MMM d, yyyy')} – ${format(new Date(intern.endDate), 'MMM d, yyyy')}`],
        ['Total Hours:', Math.round(intern.totalHours * 10) / 10],
        [],
        ['Date', 'Day', 'Time In', 'Time Out', 'Hours', 'Status', 'Notes'],
        ...intern.attendance
          .slice()
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .map(a => [
            format(new Date(a.date), 'MM/dd/yyyy'),
            format(new Date(a.date), 'EEEE'),
            a.timeIn ? format(new Date(a.timeIn), 'h:mm a') : '',
            a.timeOut ? format(new Date(a.timeOut), 'h:mm a') : '',
            a.hours ?? '',
            ATTENDANCE_STATUS_META[a.status as AttendanceStatus].label,
            a.notes ?? ''
          ])
      ]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      const sheetName = intern.fullName.slice(0, 28).replace(/[\\\/*?[\]]/g, '')
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    })
    XLSX.writeFile(wb, `All-DTR-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  const handleDragStart = (taskId: string, internId: string, fromStatus: TaskStatus) => {
    setDraggedTask({ taskId, internId, fromStatus })
  }

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    setDragOverCol(status)
  }

  const handleDrop = async (e: React.DragEvent, toStatus: TaskStatus) => {
    e.preventDefault()
    if (!draggedTask || draggedTask.fromStatus === toStatus) {
      setDraggedTask(null)
      setDragOverCol(null)
      return
    }
    await handleTaskStatusChange(draggedTask.internId, draggedTask.taskId, toStatus)
    setDraggedTask(null)
    setDragOverCol(null)
  }

  const handleDragEnd = () => {
    setDraggedTask(null)
    setDragOverCol(null)
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

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Global operation error toast */}
      {opError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-red-600 text-white px-5 py-3 rounded-2xl shadow-2xl" style={{minWidth:'260px'}}>
          <span className="text-lg">⚠️</span>
          <p className="text-sm font-semibold flex-1">{opError}</p>
          <button onClick={()=>setOpError(null)} className="text-red-200 hover:text-white font-bold text-lg leading-none ml-2">&times;</button>
        </div>
      )}

      {/* ══ ADD INTERN MODAL ═══════════════════════════════════════════════════════ */}
      {showAddIntern && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddIntern(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-display font-bold text-xl text-gray-800">Add New Intern</h2>
              <button onClick={() => setShowAddIntern(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">✕</button>
            </div>
            <div className="p-6 space-y-5">
              {/* Photo upload */}
              <div className="flex items-center gap-5 p-4 bg-gray-50 rounded-2xl">
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 overflow-hidden flex-shrink-0 flex items-center justify-center bg-white shadow-sm">
                  {internPhotoPreview
                    ? <img src={internPhotoPreview} className="w-full h-full object-cover" alt="Preview"/>
                    : <span className="text-3xl">👤</span>}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Intern Photo <span className="text-gray-400 font-normal">(optional)</span></p>
                  <label className="cursor-pointer px-4 py-2 border-2 border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-all inline-flex items-center gap-2 bg-white">
                    📷 Upload Photo
                    <input type="file" accept="image/*" className="hidden" onChange={handleInternPhotoChange}/>
                  </label>
                  {internPhotoPreview && (
                    <button onClick={() => setInternPhotoPreview(null)} className="ml-2 text-xs text-red-400 hover:text-red-600 font-semibold">✕ Remove</button>
                  )}
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG — will appear on their profile card</p>
                </div>
              </div>

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
                    rows={2} placeholder="Any additional notes..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100 resize-none"/>
                </div>
              </div>

              {/* Document uploads */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600 block">Documents <span className="text-gray-400 font-normal">(optional — MOA, IDs, endorsement letters, etc.)</span></label>
                <label className="cursor-pointer flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-all bg-gray-50/50">
                  <span className="text-lg">📎</span>
                  <span>Attach files — PDF, images, Word docs</span>
                  <input type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif" className="hidden" onChange={handleDocFileAdd}/>
                </label>
                {internDocFiles.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    {internDocFiles.map((doc, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                        <span className="text-base flex-shrink-0">{doc.type === 'PDF' ? '📄' : doc.type === 'Image' ? '🖼️' : '📎'}</span>
                        <span className="text-xs font-semibold text-gray-700 flex-1 truncate">{doc.name}</span>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{doc.type}</span>
                        <button onClick={() => handleDocFileRemove(i)} className="text-red-400 hover:text-red-600 text-xs font-bold flex-shrink-0">✕</button>
                      </div>
                    ))}
                  </div>
                )}
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
      )}

      {/* ══ LOG ATTENDANCE MODAL ═══════════════════════════════════════════════════ */}
      {showAddAttendance && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddAttendance(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-display font-bold text-xl text-gray-800">Log Attendance</h2>
              <button onClick={() => setShowAddAttendance(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Intern preview */}
              {newAttendance.internId && (() => {
                const found = interns.find(i => i.id === newAttendance.internId)
                return found ? (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                    <Avatar name={found.fullName} photo={found.photoUrl} size="md"/>
                    <div>
                      <p className="font-bold text-sm text-gray-800">{found.fullName}</p>
                      <p className="text-xs text-gray-500">{found.course} · {found.school}</p>
                    </div>
                  </div>
                ) : null
              })()}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Intern *</label>
                <select value={newAttendance.internId} onChange={e => setNewAttendance(f => ({ ...f, internId: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]">
                  <option value="">Select intern...</option>
                  {interns.map(i => <option key={i.id} value={i.id}>{i.fullName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Date</label>
                  <input type="date" value={newAttendance.date} onChange={e => setNewAttendance(f => ({ ...f, date: e.target.value }))}
                    max={format(new Date(), 'yyyy-MM-dd')}
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
      )}

      {/* ══ ASSIGN TASK MODAL ══════════════════════════════════════════════════════ */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddTask(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-display font-bold text-xl text-gray-800">Assign Task</h2>
              <button onClick={() => setShowAddTask(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Intern preview */}
              {newTask.internId && (() => {
                const found = interns.find(i => i.id === newTask.internId)
                return found ? (
                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl border border-purple-100">
                    <Avatar name={found.fullName} photo={found.photoUrl} size="md"/>
                    <div>
                      <p className="font-bold text-sm text-gray-800">{found.fullName}</p>
                      <p className="text-xs text-gray-500">{found.course} · {found.school}</p>
                      <p className="text-xs text-purple-600 font-medium mt-0.5">{found.tasks.filter(t=>t.status==='PENDING').length} pending tasks</p>
                    </div>
                  </div>
                ) : null
              })()}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Assign To *</label>
                <select value={newTask.internId} onChange={e => setNewTask(f => ({ ...f, internId: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]">
                  <option value="">Select intern...</option>
                  {interns.map(i => <option key={i.id} value={i.id}>{i.fullName}</option>)}
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
      )}

      {/* ══ EDIT INTERN MODAL ═════════════════════════════════════════════════════ */}
      {showEditIntern && selectedIntern && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEditIntern(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Avatar name={selectedIntern.fullName} photo={selectedIntern.photoUrl} size="sm"/>
                <div>
                  <h2 className="font-display font-bold text-xl text-gray-800">Edit Intern</h2>
                  <p className="text-xs text-gray-400">{selectedIntern.fullName}</p>
                </div>
              </div>
              <button onClick={() => setShowEditIntern(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Full Name *</label>
                  <input value={editInternData.fullName} onChange={e => setEditInternData(f => ({ ...f, fullName: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">School / University *</label>
                  <input value={editInternData.school} onChange={e => setEditInternData(f => ({ ...f, school: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Course / Program *</label>
                  <input value={editInternData.course} onChange={e => setEditInternData(f => ({ ...f, course: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Department</label>
                  <input value={editInternData.department} onChange={e => setEditInternData(f => ({ ...f, department: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Supervisor</label>
                  <input value={editInternData.supervisor} onChange={e => setEditInternData(f => ({ ...f, supervisor: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Start Date</label>
                  <input type="date" value={editInternData.startDate} onChange={e => setEditInternData(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">End Date</label>
                  <input type="date" value={editInternData.endDate} onChange={e => setEditInternData(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Required Hours</label>
                  <input type="number" value={editInternData.requiredHours} onChange={e => setEditInternData(f => ({ ...f, requiredHours: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Email</label>
                  <input type="email" value={editInternData.email} onChange={e => setEditInternData(f => ({ ...f, email: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Phone</label>
                  <input value={editInternData.phone} onChange={e => setEditInternData(f => ({ ...f, phone: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Status</label>
                  <select value={editInternData.status} onChange={e => setEditInternData(f => ({ ...f, status: e.target.value as InternStatus }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]">
                    {Object.entries(INTERN_STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Notes</label>
                  <textarea value={editInternData.notes} onChange={e => setEditInternData(f => ({ ...f, notes: e.target.value }))}
                    rows={2} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] focus:ring-2 focus:ring-blue-100 resize-none"/>
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowEditIntern(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleEditIntern} disabled={saving} className="flex-1 py-2.5 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <><Spinner/>Saving...</> : '✓ Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ SEND EMAIL MODAL ═══════════════════════════════════════════════════════ */}
      {showEmailModal && emailTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowEmailModal(false); setEmailResult(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-lg">✉️</div>
                <div>
                  <h2 className="font-display font-bold text-xl text-gray-800">Send Message</h2>
                  <p className="text-xs text-gray-400">to {emailTarget.fullName}</p>
                </div>
              </div>
              <button onClick={() => { setShowEmailModal(false); setEmailResult(null) }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Recipient preview */}
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <Avatar name={emailTarget.fullName} photo={emailTarget.photoUrl} size="md"/>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-800">{emailTarget.fullName}</p>
                  <p className="text-xs text-gray-500 truncate">{emailTarget.email || <span className="text-red-500">No email on file — add one via Edit</span>}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${INTERN_STATUS_META[emailTarget.status].badge}`}>
                  {INTERN_STATUS_META[emailTarget.status].label}
                </span>
              </div>

              {/* Message type */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Message Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'general',    label: 'General',    icon: '💬', color: 'border-blue-300 bg-blue-50 text-blue-700' },
                    { id: 'reminder',   label: 'Reminder',   icon: '⏰', color: 'border-yellow-300 bg-yellow-50 text-yellow-700' },
                    { id: 'task',       label: 'Task',       icon: '✅', color: 'border-purple-300 bg-purple-50 text-purple-700' },
                    { id: 'evaluation', label: 'Evaluation', icon: '📋', color: 'border-green-300 bg-green-50 text-green-700' },
                    { id: 'attendance', label: 'Attendance', icon: '📅', color: 'border-cyan-300 bg-cyan-50 text-cyan-700' },
                  ].map(t => (
                    <button key={t.id} onClick={() => setEmailData(f => ({ ...f, type: t.id }))}
                      className={`py-2 px-3 rounded-xl border-2 text-xs font-semibold transition-all flex items-center gap-1.5 justify-center ${emailData.type === t.id ? t.color + ' border-current' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">From (Sender Name)</label>
                <input value={emailData.senderName} onChange={e => setEmailData(f => ({ ...f, senderName: e.target.value }))}
                  placeholder="e.g. John Smith — DTC Supervisor"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Subject *</label>
                <input value={emailData.subject} onChange={e => setEmailData(f => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Reminder: Submit your weekly report"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Message *</label>
                <textarea value={emailData.message} onChange={e => setEmailData(f => ({ ...f, message: e.target.value }))}
                  rows={5} placeholder="Write your message here..."
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] resize-none"/>
              </div>

              {/* Quick templates */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Quick Templates</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Submit DTR', text: 'Please submit your Daily Time Record (DTR) for this week. Kindly ensure it is complete and signed before end of day.' },
                    { label: 'Meeting Tomorrow', text: 'Please be advised that there will be a meeting tomorrow. Kindly be present at the office at 9:00 AM. Please come prepared.' },
                    { label: 'Completion', text: `Congratulations on completing your internship with the Department of Information and Communications Technology — Digital Transformation Center, Region V! We commend your hard work and dedication throughout your stay.` },
                  ].map(t => (
                    <button key={t.label} onClick={() => setEmailData(f => ({ ...f, message: t.text }))}
                      className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-all font-semibold">
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Result feedback */}
              {emailResult && (
                <div className={`flex items-center gap-3 p-3 rounded-xl border ${emailResult.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  <span>{emailResult.ok ? '✓' : '✗'}</span>
                  <p className="text-sm font-semibold">{emailResult.msg}</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button onClick={() => { setShowEmailModal(false); setEmailResult(null) }} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                {emailResult?.ok ? 'Close' : 'Cancel'}
              </button>
              {!emailResult?.ok && (
                <button onClick={handleSendEmail}
                  disabled={emailSending || !emailTarget.email || !emailData.subject || !emailData.message}
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                  {emailSending ? <><Spinner/>Sending...</> : '✉️ Send Email'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
              <button onClick={() => signOut({ callbackUrl: '/sign-in' })} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-200 hover:text-white hover:bg-white/10 transition-all">🔒 Sign Out</button>
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
            <nav className="flex-shrink-0 px-2 pt-1 space-y-1">
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

            {/* ── School Directory ────────────────────────────────────────────── */}
            {sidebarOpen && schoolGroups.length > 0 && (
              <div className="flex-1 px-3 py-3 min-h-0 overflow-y-auto">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <span className="flex-1 h-px bg-gray-200"/>
                  Schools
                  <span className="flex-1 h-px bg-gray-200"/>
                </p>
                <div className="space-y-1">
                  <button
                    onClick={() => { setFilterSchool('all'); setSelectedIntern(null); setActiveSection('interns') }}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition-all ${
                      filterSchool === 'all' && activeSection === 'interns' ? 'bg-[var(--dict-blue)]/10 text-[var(--dict-blue)] font-bold' : 'text-gray-600 hover:bg-gray-100'
                    }`}>
                    <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0"/>
                    <span className="truncate font-semibold">All Schools</span>
                    <span className="ml-auto text-[10px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-bold flex-shrink-0">{interns.length}</span>
                  </button>
                  {schoolGroups.map(([school, members]) => {
                    const sc = getSchoolColor(school)
                    const active = filterSchool === school && activeSection === 'interns'
                    const activeCount = members.filter(m => m.status === 'ACTIVE').length
                    const completedCount = members.filter(m => m.status === 'COMPLETED').length
                    return (
                      <button key={school}
                        onClick={() => { setFilterSchool(school); setSelectedIntern(null); setActiveSection('interns') }}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition-all ${
                          active ? `${sc.light} ${sc.text} font-bold ring-1 ${sc.ring}` : 'text-gray-600 hover:bg-gray-100'
                        }`}>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`}/>
                        <div className="flex-1 text-left min-w-0">
                          <p className="truncate font-semibold leading-tight">{school}</p>
                          <p className="text-[10px] text-gray-400 leading-tight">{activeCount} active{completedCount > 0 ? ` · ${completedCount} done` : ''}</p>
                        </div>
                        <span className={`text-[10px] ${sc.bg} ${sc.text} rounded-full px-1.5 py-0.5 font-bold flex-shrink-0`}>{members.length}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {/* collapsed school dots */}
            {!sidebarOpen && schoolGroups.length > 0 && (
              <div className="flex flex-col items-center gap-1.5 py-2">
                {schoolGroups.map(([school]) => {
                  const sc = getSchoolColor(school)
                  return <span key={school} title={school} className={`w-2.5 h-2.5 rounded-full ${sc.dot} cursor-pointer`}
                    onClick={() => { setFilterSchool(school); setSelectedIntern(null); setActiveSection('interns') }}/>
                })}
              </div>
            )}

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
                      const sc = getSchoolColor(intern.school)
                      const dept = getDeptBadge(intern)
                      const pct = Math.min(100, Math.round((intern.totalHours / intern.requiredHours) * 100))
                      return (
                        <div key={intern.id}
                          className="rounded-2xl border-2 border-gray-100 hover:border-[var(--dict-blue)] hover:shadow-lg transition-all cursor-pointer overflow-hidden group"
                          onClick={() => { setSelectedIntern(intern); setActiveSection('interns') }}>
                          {/* School color strip */}
                          <div className={`h-1.5 bg-gradient-to-r ${sc.grad}`}/>
                          <div className="p-4">
                            <div className="flex items-start gap-3 mb-3">
                              <div className="relative flex-shrink-0">
                                <Avatar name={intern.fullName} photo={intern.photoUrl} size="lg"/>
                                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm"/>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-sm text-gray-800 truncate leading-tight">{intern.fullName}</p>
                                <p className="text-xs text-gray-500 truncate mt-0.5">{intern.course}</p>
                                <p className={`text-xs font-semibold truncate mt-0.5 ${sc.text}`}>{intern.school}</p>
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {dept && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${dept.color}`}>{dept.icon} {dept.short}</span>
                                  )}
                                  {intern.department && !dept && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full border font-bold bg-gray-100 text-gray-600 border-gray-200">{intern.department}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <HoursProgress current={intern.totalHours} required={intern.requiredHours}/>
                            <div className="flex items-center justify-between mt-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pct >= 100 ? 'bg-green-100 text-green-700' : pct >= 70 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{pct}%</span>
                                <span className="text-xs text-gray-400">{daysLeft > 0 ? `${daysLeft}d left` : '⚠️ Ended'}</span>
                              </div>
                              <span className="text-xs text-gray-400 group-hover:text-blue-500 transition-colors">{intern.tasks.filter(t => t.status === 'PENDING').length} tasks →</span>
                            </div>
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
              <div className="glass rounded-2xl p-3 space-y-2">
                <div className="flex flex-wrap gap-2 items-center">
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by name, school, or course..."
                    className="flex-1 min-w-[180px] border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--dict-blue)]"/>
                  <div className="flex flex-wrap gap-1.5">
                    {['all', 'ACTIVE', 'COMPLETED', 'INACTIVE', 'ON_LEAVE'].map(s => (
                      <button key={s} onClick={() => { setFilterStatus(s); setSelectedIntern(null) }}
                        className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all ${filterStatus === s ? 'bg-[var(--dict-blue)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {s === 'all' ? 'All' : INTERN_STATUS_META[s as InternStatus].label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* School filter chips */}
                {schoolGroups.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">School:</span>
                    <button onClick={() => { setFilterSchool('all'); setSelectedIntern(null) }}
                      className={`text-xs px-3 py-1 rounded-full font-semibold transition-all border ${
                        filterSchool === 'all' ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}>All</button>
                    {schoolGroups.map(([school, members]) => {
                      const sc = getSchoolColor(school)
                      const isActive = filterSchool === school
                      return (
                        <button key={school} onClick={() => { setFilterSchool(school); setSelectedIntern(null) }}
                          className={`text-xs px-3 py-1 rounded-full font-semibold transition-all border flex items-center gap-1.5 ${
                            isActive ? `${sc.dot.replace('bg-','bg-')} text-white border-transparent` : `bg-white ${sc.text} ${sc.border} hover:${sc.light}`
                          }`}
                          style={isActive ? { background: sc.dot.includes('blue') ? '#3b82f6' : sc.dot.includes('purple') ? '#a855f7' : sc.dot.includes('emerald') ? '#10b981' : sc.dot.includes('orange') ? '#f97316' : sc.dot.includes('rose') ? '#f43f5e' : sc.dot.includes('teal') ? '#14b8a6' : sc.dot.includes('indigo') ? '#6366f1' : sc.dot.includes('amber') ? '#f59e0b' : sc.dot.includes('cyan') ? '#06b6d4' : '#d946ef', color: 'white' } : {}}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white/70' : sc.dot}`}/>
                          {school}
                          <span className={`text-[10px] font-bold ${isActive ? 'bg-white/20 text-white' : sc.bg + ' ' + sc.text} rounded-full px-1.5`}>{members.length}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
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
                        <button
                          onClick={() => {
                            setEditInternData({
                              fullName: selectedIntern.fullName,
                              school: selectedIntern.school,
                              course: selectedIntern.course,
                              department: selectedIntern.department || '',
                              supervisor: selectedIntern.supervisor || '',
                              startDate: selectedIntern.startDate.split('T')[0],
                              endDate: selectedIntern.endDate.split('T')[0],
                              requiredHours: String(selectedIntern.requiredHours),
                              email: selectedIntern.email || '',
                              phone: selectedIntern.phone || '',
                              notes: selectedIntern.notes || '',
                              status: selectedIntern.status,
                            })
                            setShowEditIntern(true)
                          }}
                          className="text-xs px-3 py-2 rounded-xl bg-white/20 text-white border border-white/30 hover:bg-white/30 transition-all">
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => { setEmailTarget(selectedIntern); setEmailResult(null); setShowEmailModal(true) }}
                          className="text-xs px-3 py-2 rounded-xl bg-white/20 text-white border border-white/30 hover:bg-white/30 transition-all">
                          ✉️ Message
                        </button>
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
                          {selectedIntern.attendance.slice().sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime()).slice(-10).map(a => {
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
                      {/* School-grouped table */}
                      {(() => {
                        const groups = filterSchool !== 'all'
                          ? [[filterSchool, filteredInterns] as [string, Intern[]]]
                          : (() => {
                              const map = new Map<string, Intern[]>()
                              filteredInterns.forEach(i => {
                                if (!map.has(i.school)) map.set(i.school, [])
                                map.get(i.school)!.push(i)
                              })
                              return Array.from(map.entries()).sort((a,b) => a[0].localeCompare(b[0]))
                            })()
                        return (
                          <table className="w-full">
                            <thead>
                              <tr className="bg-gray-50 border-b-2 border-gray-100">
                                <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3">Intern</th>
                                <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3">Course</th>
                                <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3">Period</th>
                                <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3 min-w-[150px]">Progress</th>
                                <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3">Status</th>
                                <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3">Days Left</th>
                                <th className="text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {groups.map(([school, members]) => {
                                const sc = getSchoolColor(school)
                                const activeCount = members.filter(m => m.status === 'ACTIVE').length
                                const completedCount = members.filter(m => m.status === 'COMPLETED').length
                                return (
                                  <React.Fragment key={school}>
                                    {/* School group header */}
                                    <tr>
                                      <td colSpan={7} className="px-4 pt-4 pb-1">
                                        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${sc.light} ${sc.border} border`}>
                                          <span className={`w-3 h-3 rounded-full flex-shrink-0 ${sc.dot}`}/>
                                          <span className={`text-sm font-bold ${sc.text} truncate flex-1`}>🏫 {school}</span>
                                          <div className="flex items-center gap-2 flex-shrink-0">
                                            {activeCount > 0 && <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">{activeCount} active</span>}
                                            {completedCount > 0 && <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">✓ {completedCount} done</span>}
                                            <span className={`text-xs ${sc.bg} ${sc.text} font-bold px-2 py-0.5 rounded-full`}>{members.length} intern{members.length !== 1 ? 's' : ''}</span>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                    {/* Intern rows */}
                                    {members.map(intern => {
                                      const sm = INTERN_STATUS_META[intern.status]
                                      const daysLeft = differenceInDays(new Date(intern.endDate), new Date())
                                      const pct = Math.min(100, Math.round((intern.totalHours / intern.requiredHours) * 100))
                                      const isCompleted = intern.status === 'COMPLETED'
                                      const isInactive = intern.status === 'INACTIVE'
                                      const rowStyle = isCompleted
                                        ? 'bg-gradient-to-r from-green-50/80 to-emerald-50/60 hover:from-green-100/80'
                                        : isInactive ? 'bg-gray-50/80 opacity-70 hover:opacity-100'
                                        : 'hover:bg-blue-50/40'
                                      return (
                                        <tr key={intern.id}
                                          className={`border-b border-gray-50 transition-all cursor-pointer group ${rowStyle}`}
                                          onClick={() => setSelectedIntern(intern)}>
                                          {/* Name + avatar */}
                                          <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                              <div className="relative flex-shrink-0">
                                                <Avatar name={intern.fullName} photo={intern.photoUrl} size="sm"/>
                                                {isCompleted && (
                                                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow">✓</span>
                                                )}
                                              </div>
                                              <div className="min-w-0">
                                                <p className={`font-bold text-sm truncate max-w-[140px] ${isCompleted ? 'text-green-800' : 'text-gray-800'}`}>{intern.fullName}</p>
                                                {intern.supervisor && <p className="text-xs text-gray-400 truncate">👤 {intern.supervisor}</p>}
                                              </div>
                                            </div>
                                          </td>
                                          {/* Course */}
                                          <td className="px-4 py-3">
                                            <p className="text-xs text-gray-600 font-medium truncate max-w-[160px]">{intern.course}</p>
                                          </td>
                                          {/* Period */}
                                          <td className="px-4 py-3 whitespace-nowrap">
                                            <p className="text-xs text-gray-600">{format(new Date(intern.startDate), 'MMM d')} – {format(new Date(intern.endDate), 'MMM d, yyyy')}</p>
                                          </td>
                                          {/* Progress */}
                                          <td className="px-4 py-3 min-w-[150px]">
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="text-xs text-gray-500">{Math.round(intern.totalHours)}h / {intern.requiredHours}h</span>
                                              <span className={`text-xs font-bold ${
                                                pct >= 100 ? 'text-green-600' : pct >= 70 ? 'text-blue-600' : pct >= 40 ? 'text-yellow-600' : 'text-red-500'
                                              }`}>{pct}%</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                              <div className={`h-2 rounded-full transition-all bg-gradient-to-r ${
                                                pct >= 100 ? 'from-green-400 to-emerald-500' :
                                                pct >= 70  ? 'from-blue-400 to-indigo-500' :
                                                pct >= 40  ? 'from-yellow-400 to-orange-400' :
                                                             'from-red-400 to-rose-500'
                                              }`} style={{ width: `${pct}%` }}/>
                                            </div>
                                          </td>
                                          {/* Status */}
                                          <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-1 rounded-full border font-semibold whitespace-nowrap ${sm.badge}`}>{sm.label}</span>
                                          </td>
                                          {/* Days left */}
                                          <td className="px-4 py-3">
                                            {isCompleted ? (
                                              <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">🎓 Done</span>
                                            ) : daysLeft > 30 ? (
                                              <span className="text-sm font-bold text-gray-700">{daysLeft}d</span>
                                            ) : daysLeft > 7 ? (
                                              <span className="text-sm font-bold text-orange-600">{daysLeft}d</span>
                                            ) : daysLeft > 0 ? (
                                              <span className="text-sm font-bold text-red-600 animate-pulse">{daysLeft}d!</span>
                                            ) : daysLeft === 0 ? (
                                              <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Last day!</span>
                                            ) : (
                                              <span className="text-xs text-gray-400">{Math.abs(daysLeft)}d ago</span>
                                            )}
                                          </td>
                                          {/* Actions */}
                                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                              {!isCompleted && (
                                                <button onClick={() => { setNewAttendance(f => ({ ...f, internId: intern.id })); setShowAddAttendance(true) }}
                                                  title="Log attendance" className="w-7 h-7 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 flex items-center justify-center text-xs font-bold transition-all">✓</button>
                                              )}
                                              <button onClick={() => { setNewTask(f => ({ ...f, internId: intern.id })); setShowAddTask(true) }}
                                                title="Assign task" className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 flex items-center justify-center text-xs transition-all">+</button>
                                              <button onClick={() => setSelectedIntern(intern)}
                                                title="View profile" className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center justify-center text-xs transition-all">→</button>
                                              <button onClick={() => { setEmailTarget(intern); setEmailResult(null); setShowEmailModal(true) }}
                                                title="Send message" className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 flex items-center justify-center text-xs transition-all">✉️</button>
                                            </div>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </React.Fragment>
                                )
                              })}
                            </tbody>
                          </table>
                        )
                      })()}
                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
                        <span>Showing {filteredInterns.length} of {interns.length} interns{filterSchool !== 'all' ? ` · filtered by ${filterSchool}` : ''} · Click row to view profile</span>
                        {filterSchool !== 'all' && (
                          <button onClick={() => setFilterSchool('all')} className="text-xs text-blue-600 hover:underline font-semibold">Clear school filter ×</button>
                        )}
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
                  <p className="text-sm text-gray-500 mt-0.5">Daily time records — export each intern's DTR as Excel</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={exportAllDTR}
                    className="px-4 py-2 border-2 border-green-400 text-green-700 rounded-xl text-sm font-bold hover:bg-green-50 transition-all flex items-center gap-2">
                    ↓ Export All DTR
                  </button>
                  <button onClick={() => setShowAddAttendance(true)}
                    className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                    ✓ Log Attendance
                  </button>
                </div>
              </div>

              {interns.map(intern => {
                const sorted = intern.attendance.slice().sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                const weekHours = intern.attendance.filter(a => {
                  const diff = (Date.now() - new Date(a.date).getTime()) / (1000*60*60*24)
                  return diff <= 7
                }).reduce((s, a) => s + (a.hours ?? 0), 0)
                const presentDays = intern.attendance.filter(a => a.status === 'PRESENT' || a.status === 'HALF_DAY').length
                const absentDays  = intern.attendance.filter(a => a.status === 'ABSENT').length

                return (
                  <div key={intern.id} className="glass rounded-2xl overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar name={intern.fullName} photo={intern.photoUrl} size="md"/>
                            {activeClockIn[intern.id] && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse"/>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800">{intern.fullName}</p>
                            <p className="text-xs text-gray-500">{intern.course} · {intern.school}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-400">Week: <strong className="text-gray-700">{Math.round(weekHours*10)/10}h</strong></span>
                              <span className="text-xs text-gray-400">Total: <strong className="text-[var(--dict-blue)]">{Math.round(intern.totalHours*10)/10}h/{intern.requiredHours}h</strong></span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => exportDTR(intern)}
                            className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-200 transition-all">
                            ↓ DTR
                          </button>
                          <button onClick={() => { setNewAttendance(f => ({ ...f, internId: intern.id })); setShowAddAttendance(true) }}
                            className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-all">
                            + Manual
                          </button>
                        </div>
                      </div>

                      {/* ── Time In / Time Out live buttons ── */}
                      <div className={`rounded-xl p-3 flex items-center gap-3 flex-wrap ${activeClockIn[intern.id] ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-100'}`}>
                        {!activeClockIn[intern.id] ? (
                          <>
                            <button
                              onClick={() => {
                                const now = new Date()
                                setActiveClockIn(prev => ({ ...prev, [intern.id]: { startTime: now, display: '00:00:00' } }))
                                setNewAttendance(f => ({
                                  ...f, internId: intern.id,
                                  date: format(now, 'yyyy-MM-dd'),
                                  timeIn: format(now, 'HH:mm'),
                                  status: 'PRESENT',
                                }))
                              }}
                              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-sm shadow hover:shadow-md transition-all">
                              <span className="w-2.5 h-2.5 rounded-full bg-white/70"/>
                              Time In
                            </button>
                            <p className="text-xs text-gray-400 italic">Click to start today's clock</p>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-3 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"/>
                                <span className="font-mono font-bold text-2xl text-green-700 tracking-widest tabular-nums">
                                  {activeClockIn[intern.id].display}
                                </span>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-green-700">Clocked in since</p>
                                <p className="text-xs text-gray-500">{format(activeClockIn[intern.id].startTime, 'h:mm a')} · {format(activeClockIn[intern.id].startTime, 'MMM d, yyyy')}</p>
                              </div>
                            </div>
                            <button
                              onClick={async () => {
                                const entry = activeClockIn[intern.id]
                                if (!entry) return
                                const timeOut = new Date()
                                const hours = Math.round(((timeOut.getTime() - entry.startTime.getTime()) / (1000 * 3600)) * 100) / 100
                                // submit attendance record
                                await fetch(`/api/interns/${intern.id}/attendance`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    date: format(entry.startTime, 'yyyy-MM-dd'),
                                    timeIn: entry.startTime.toISOString(),
                                    timeOut: timeOut.toISOString(),
                                    hours,
                                    status: 'PRESENT',
                                    notes: `Auto-logged via Time In/Out`,
                                  }),
                                })
                                setActiveClockIn(prev => { const n = { ...prev }; delete n[intern.id]; return n })
                                fetchInterns()
                              }}
                              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-bold text-sm shadow hover:shadow-md transition-all">
                              <span className="w-2.5 h-2.5 rounded-full bg-white/70"/>
                              Time Out
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="p-4 space-y-4">
                      {/* Progress + summary stats */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-3 sm:col-span-1">
                          <HoursProgress current={intern.totalHours} required={intern.requiredHours}/>
                        </div>
                        <div className="flex gap-3 col-span-3 sm:col-span-2 justify-end">
                          {[{label:'Present',val:presentDays,c:'text-green-600 bg-green-50'},{label:'Absent',val:absentDays,c:'text-red-600 bg-red-50'},{label:'Records',val:intern.attendance.length,c:'text-blue-600 bg-blue-50'}].map(s=>(
                            <div key={s.label} className={`px-4 py-2 rounded-xl text-center ${s.c}`}>
                              <p className="text-xl font-bold">{s.val}</p>
                              <p className="text-xs font-semibold">{s.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Day chips */}
                      {sorted.length === 0 ? (
                        <p className="text-center text-gray-400 text-xs py-2">No records yet</p>
                      ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-10 gap-1.5">
                          {sorted.slice(-20).map(a => {
                            const m = ATTENDANCE_STATUS_META[a.status as AttendanceStatus]
                            return (
                              <div key={a.id} className={`rounded-xl p-2 border text-center group relative ${m.color} border-current/20 cursor-default`}
                                title={`${format(new Date(a.date),'MMM d, yyyy')} — ${m.label}${a.hours ? ` · ${a.hours}h` : ''}`}>
                                <p className="text-xs font-bold leading-none">{format(new Date(a.date),'MMM d')}</p>
                                <p className="text-base mt-0.5">{m.icon}</p>
                                {a.hours && <p className="text-xs font-semibold">{a.hours}h</p>}
                                <button onClick={() => handleDeleteAttendance(intern.id, a.id)}
                                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs hidden group-hover:flex items-center justify-center shadow">✕</button>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Full DTR table */}
                      {sorted.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs font-semibold text-blue-600 cursor-pointer hover:underline select-none">
                            View full DTR table ({intern.attendance.length} records)
                          </summary>
                          <div className="overflow-x-auto mt-3 rounded-xl border border-gray-100">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                  {['Date','Day','Time In','Time Out','Hours','Status','Notes'].map(h=>(
                                    <th key={h} className="text-left text-xs font-bold text-gray-500 px-3 py-2">{h}</th>
                                  ))}
                                  <th className="px-3 py-2"/>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {sorted.map(a => {
                                  const m = ATTENDANCE_STATUS_META[a.status as AttendanceStatus]
                                  return (
                                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                                      <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">{format(new Date(a.date),'MMM d, yyyy')}</td>
                                      <td className="px-3 py-2 text-gray-500 text-xs">{format(new Date(a.date),'EEE')}</td>
                                      <td className="px-3 py-2 font-mono text-xs text-gray-600">{a.timeIn ? format(new Date(a.timeIn),'h:mm a') : '—'}</td>
                                      <td className="px-3 py-2 font-mono text-xs text-gray-600">{a.timeOut ? format(new Date(a.timeOut),'h:mm a') : '—'}</td>
                                      <td className="px-3 py-2 font-bold text-gray-800">{a.hours ? `${a.hours}h` : '—'}</td>
                                      <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${m.color}`}>{m.label}</span></td>
                                      <td className="px-3 py-2 text-xs text-gray-400 max-w-[120px] truncate">{a.notes || '—'}</td>
                                      <td className="px-3 py-2 text-right">
                                        <button onClick={() => handleDeleteAttendance(intern.id, a.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                )
              })}

              {interns.length === 0 && (
                <div className="glass rounded-2xl py-16 text-center">
                  <p className="text-5xl mb-4">📅</p>
                  <p className="text-gray-500 font-medium">No interns to show attendance for</p>
                </div>
              )}
            </div>
          )}

          {/* ══ TASKS ════════════════════════════════════════════════════════════ */}
          {activeSection === 'tasks' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="font-display font-bold text-2xl text-gray-800">Task Board</h1>
                  <p className="text-sm text-gray-500 mt-0.5">{allTasks.length} total · {allTasks.filter(t=>t.status==='PENDING').length} pending · {allTasks.filter(t=>t.status==='IN_PROGRESS').length} in progress · {allTasks.filter(t=>t.status==='COMPLETED').length} done</p>
                </div>
                <button onClick={() => setShowAddTask(true)}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                  + Assign Task
                </button>
              </div>

              {/* ── Active Intern Face Row ── */}
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filter by Intern</p>
                  {taskInternFilter !== 'all' && (
                    <button onClick={() => setTaskInternFilter('all')} className="text-xs text-blue-600 hover:underline font-semibold">Clear ×</button>
                  )}
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                  {/* All button */}
                  <button onClick={() => setTaskInternFilter('all')}
                    className={`flex flex-col items-center gap-1.5 flex-shrink-0 p-2 rounded-xl transition-all ${taskInternFilter === 'all' ? 'bg-[var(--dict-blue)]/10 ring-2 ring-[var(--dict-blue)]' : 'hover:bg-gray-100'}`}>
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-xl font-bold text-gray-500">★</div>
                    <span className="text-[10px] font-semibold text-gray-500 whitespace-nowrap">All</span>
                  </button>
                  {interns.filter(i => i.tasks.length > 0).map(intern => {
                    const active = taskInternFilter === intern.id
                    const sc = getSchoolColor(intern.school)
                    const pendingCount = intern.tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length
                    return (
                      <button key={intern.id} onClick={() => setTaskInternFilter(intern.id)}
                        className={`flex flex-col items-center gap-1.5 flex-shrink-0 p-2 rounded-xl transition-all ${active ? `${sc.light} ring-2 ${sc.ring}` : 'hover:bg-gray-100'}`}>
                        <div className="relative">
                          <Avatar name={intern.fullName} photo={intern.photoUrl} size="lg"/>
                          {pendingCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center shadow">{pendingCount}</span>
                          )}
                        </div>
                        <span className={`text-[10px] font-semibold whitespace-nowrap max-w-[56px] truncate ${active ? sc.text : 'text-gray-600'}`}>{intern.fullName.split(' ')[0]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── Selected intern quick stats (when filtered) ── */}
              {taskInternFilter !== 'all' && (() => {
                const fi = interns.find(i => i.id === taskInternFilter)
                if (!fi) return null
                const dept = getDeptBadge(fi)
                const sc = getSchoolColor(fi.school)
                return (
                  <div className={`rounded-2xl p-4 flex items-center gap-4 ${sc.light} border ${sc.border}`}>
                    <Avatar name={fi.fullName} photo={fi.photoUrl} size="lg"/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-bold text-lg ${sc.text}`}>{fi.fullName}</p>
                        {dept && <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${dept.color}`}>{dept.icon} {dept.short}</span>}
                      </div>
                      <p className="text-xs text-gray-500">{fi.course} · {fi.school}</p>
                      <div className="flex gap-3 mt-1.5 flex-wrap">
                        {[
                          { label: 'Pending', val: fi.tasks.filter(t=>t.status==='PENDING').length, c: 'text-gray-700 bg-gray-100' },
                          { label: 'In Progress', val: fi.tasks.filter(t=>t.status==='IN_PROGRESS').length, c: 'text-blue-700 bg-blue-100' },
                          { label: 'Done', val: fi.tasks.filter(t=>t.status==='COMPLETED').length, c: 'text-green-700 bg-green-100' },
                        ].map(s => (
                          <span key={s.label} className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.c}`}>{s.val} {s.label}</span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => { setNewTask(f => ({ ...f, internId: fi.id })); setShowAddTask(true) }}
                      className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-xl text-sm font-bold shadow hover:shadow-md transition-all flex-shrink-0">
                      + Task
                    </button>
                  </div>
                )
              })()}

              {/* Kanban board */}
              <div className="grid md:grid-cols-4 gap-4">
                {(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as TaskStatus[]).map(status => {
                  const statusTasks = allTasks.filter(t => t.status === status && (taskInternFilter === 'all' || t.internId === taskInternFilter))
                  const tm = TASK_STATUS_META[status]
                  const isOver = dragOverCol === status
                  const colAccent: Record<TaskStatus, string> = {
                    PENDING:     'border-gray-300 bg-gray-50/60',
                    IN_PROGRESS: 'border-blue-300 bg-blue-50/60',
                    COMPLETED:   'border-green-300 bg-green-50/60',
                    CANCELLED:   'border-red-200 bg-red-50/60',
                  }
                  const colHeader: Record<TaskStatus, string> = {
                    PENDING:     'bg-gray-100 text-gray-700',
                    IN_PROGRESS: 'bg-blue-100 text-blue-700',
                    COMPLETED:   'bg-green-100 text-green-700',
                    CANCELLED:   'bg-red-100 text-red-600',
                  }
                  return (
                    <div key={status}
                      onDragOver={e => handleDragOver(e, status)}
                      onDrop={e => handleDrop(e, status)}
                      className={`rounded-2xl border-2 transition-all duration-200 ${colAccent[status]} ${isOver ? 'scale-[1.02] ring-2 ring-blue-400 shadow-lg' : ''}`}>
                      {/* Column header */}
                      <div className={`flex items-center justify-between px-4 py-3 rounded-t-2xl ${colHeader[status]}`}>
                        <h3 className="text-sm font-bold flex items-center gap-2">
                          <span>{tm.icon}</span>{tm.label}
                        </h3>
                        <span className="text-xs bg-white/70 rounded-full px-2 py-0.5 font-bold shadow-sm">{statusTasks.length}</span>
                      </div>

                      {/* Drop zone */}
                      <div className="p-3 space-y-2 min-h-[200px]">
                        {statusTasks.map(task => {
                          const pm = PRIORITY_META[task.priority] || PRIORITY_META.MEDIUM
                          const intern = interns.find(i => i.id === task.internId)
                          const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED'
                          const isDragging = draggedTask?.taskId === task.id
                          return (
                            <div key={task.id}
                              draggable
                              onDragStart={() => handleDragStart(task.id, task.internId, task.status)}
                              onDragEnd={handleDragEnd}
                              className={`bg-white rounded-xl p-3 border shadow-sm cursor-grab active:cursor-grabbing transition-all duration-150 select-none ${isDragging ? 'opacity-40 scale-95 rotate-1' : 'hover:shadow-md hover:-translate-y-0.5'} ${isOverdue ? 'border-red-300' : 'border-gray-100'}`}>

                              {/* Drag handle + title */}
                              <div className="flex items-start gap-2 mb-2">
                                <span className="text-gray-300 text-xs mt-0.5 flex-shrink-0 select-none">⠿</span>
                                <p className="text-sm font-semibold text-gray-800 leading-tight flex-1">{task.title}</p>
                                <button onClick={() => handleDeleteTask(task.internId, task.id)}
                                  className="text-red-300 hover:text-red-500 text-xs flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Delete task">✕</button>
                              </div>

                              {task.description && (
                                <p className="text-xs text-gray-400 mb-2 line-clamp-2 pl-4">{task.description}</p>
                              )}

                              {/* Priority + Due date */}
                              <div className="flex items-center gap-1.5 flex-wrap pl-4 mb-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${pm.color}`}>{pm.label}</span>
                                {task.dueDate && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                                    {isOverdue ? '⚠️' : '📅'} {format(new Date(task.dueDate), 'MMM d')}
                                  </span>
                                )}
                              </div>

                              {/* Assigned intern + quick status buttons */}
                              <div className="flex items-center justify-between pl-4 mt-1">
                                {intern ? (
                                  <div className="flex items-center gap-1.5">
                                    <Avatar name={intern.fullName} photo={intern.photoUrl} size="sm"/>
                                    <span className="text-xs text-gray-500 truncate max-w-[70px]">{intern.fullName.split(' ')[0]}</span>
                                  </div>
                                ) : <span/>}
                                <div className="flex gap-1">
                                  {status !== 'COMPLETED' && (
                                    <button onClick={() => handleTaskStatusChange(task.internId, task.id, 'COMPLETED')}
                                      title="Mark complete"
                                      className="w-6 h-6 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 flex items-center justify-center text-xs transition-all">✓</button>
                                  )}
                                  {status === 'PENDING' && (
                                    <button onClick={() => handleTaskStatusChange(task.internId, task.id, 'IN_PROGRESS')}
                                      title="Start task"
                                      className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center justify-center text-xs transition-all">▶</button>
                                  )}
                                  <button onClick={() => handleResendTask(task.internId, task)}
                                    title="Resend / reassign as new pending task"
                                    className="w-6 h-6 rounded-lg bg-yellow-50 text-yellow-600 hover:bg-yellow-100 flex items-center justify-center text-xs transition-all">↺</button>
                                  <button onClick={() => handleDeleteTask(task.internId, task.id)}
                                    title="Delete"
                                    className="w-6 h-6 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center text-xs transition-all">✕</button>
                                </div>
                              </div>
                            </div>
                          )
                        })}

                        {/* Empty drop target */}
                        {statusTasks.length === 0 && (
                          <div className={`rounded-xl border-2 border-dashed p-6 text-center transition-all ${isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
                            <p className="text-xs text-gray-300 font-medium">{isOver ? 'Drop here' : 'No tasks'}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Per-intern task list */}
              <div className="glass rounded-2xl p-5">
                <h2 className="font-display font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-sm">👤</span>
                  Tasks by Intern
                </h2>
                <div className="space-y-4">
                  {interns.filter(i => i.tasks.length > 0).map(intern => (
                    <div key={intern.id} className="border-2 border-gray-100 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={intern.fullName} photo={intern.photoUrl} size="sm"/>
                          <div>
                            <p className="font-bold text-sm text-gray-800">{intern.fullName}</p>
                            <p className="text-xs text-gray-400">{intern.tasks.filter(t=>t.status==='COMPLETED').length}/{intern.tasks.length} tasks done</p>
                          </div>
                        </div>
                        <button onClick={() => { setNewTask(f => ({ ...f, internId: intern.id })); setShowAddTask(true) }}
                          className="text-xs px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg font-semibold hover:bg-purple-200 transition-all">
                          + Task
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {intern.tasks.map(task => {
                          const tm = TASK_STATUS_META[task.status]
                          const pm = PRIORITY_META[task.priority] || PRIORITY_META.MEDIUM
                          const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED'
                          return (
                            <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-all">
                              <span className="text-base">{tm.icon}</span>
                              <p className={`flex-1 text-sm font-medium truncate ${task.status === 'COMPLETED' ? 'line-through text-gray-400' : 'text-gray-700'}`}>{task.title}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold hidden sm:block ${pm.color}`}>{pm.label}</span>
                              {task.dueDate && (
                                <span className={`text-xs font-semibold hidden md:block ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                                  {isOverdue ? '⚠️ ' : ''}Due {format(new Date(task.dueDate), 'MMM d')}
                                </span>
                              )}
                              <select value={task.status} onChange={e => handleTaskStatusChange(intern.id, task.id, e.target.value as TaskStatus)}
                                className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 outline-none text-gray-600 cursor-pointer flex-shrink-0">
                                {Object.entries(TASK_STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                              </select>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  {interns.filter(i => i.tasks.length > 0).length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-3xl mb-2">✅</p>
                      <p className="text-sm">No tasks assigned yet</p>
                      <button onClick={() => setShowAddTask(true)} className="mt-2 text-purple-500 text-xs font-semibold hover:underline">+ Assign first task</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══ CALENDAR ════════════════════════════════════════════════════════ */}
          {activeSection === 'calendar' && (() => {
            const monthStart  = startOfMonth(calendarDate)
            const monthEnd    = endOfMonth(calendarDate)
            const gridStart   = startOfWeek(monthStart, { weekStartsOn: 0 })
            const gridEnd     = endOfWeek(monthEnd,    { weekStartsOn: 0 })
            const days        = eachDayOfInterval({ start: gridStart, end: gridEnd })
            const selectedKey = calendarSelectedDay ? format(calendarSelectedDay, 'yyyy-MM-dd') : null
            const selectedTasks = selectedKey ? (tasksByDate.get(selectedKey) || []) : []
            const selectedAttendance = selectedKey ? (attendanceByDate.get(selectedKey) || []) : []
            const todayKey = format(new Date(), 'yyyy-MM-dd')
            const todayTasks = tasksByDate.get(todayKey) || []
            const overdueCount = allTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length
            const PRIORITY_COLORS: Record<string, string> = { LOW: 'bg-gray-400', MEDIUM: 'bg-yellow-400', HIGH: 'bg-orange-500', URGENT: 'bg-red-500' }

            // Build attendance marquee data for interns with today's attendance or any recent record
            const marqueeInterns = interns.flatMap(intern =>
              intern.attendance.slice().sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0,1).map(a => ({
                intern, att: a,
              }))
            )

            return (
              <div className="space-y-5">
                {/* Header with today's date prominent */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h1 className="font-display font-bold text-2xl text-gray-800">Calendar</h1>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm font-bold text-[var(--dict-blue)]">{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
                      <span className="text-xs text-gray-400">· {activeInterns.length} active intern{activeInterns.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setCalendarDate(new Date())} className="px-3 py-2 border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all">Today</button>
                    <button onClick={() => setShowAddTask(true)}
                      className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-xl text-sm font-bold shadow hover:shadow-lg transition-all">
                      + Task
                    </button>
                    <button onClick={() => setShowAddAttendance(true)}
                      className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-bold shadow hover:shadow-lg transition-all">
                      ✓ Attend
                    </button>
                  </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-5">
                  {/* ── Calendar grid + attendance below ── */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="glass rounded-2xl overflow-hidden">
                      {/* Month navigator */}
                      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <button onClick={() => setCalendarDate(d => subMonths(d, 1))}
                          className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-all font-bold text-lg">‹</button>
                        <div className="text-center">
                          <p className="font-display font-bold text-lg text-gray-800">{format(calendarDate, 'MMMM yyyy')}</p>
                          <p className="text-xs text-gray-400">{allTasks.filter(t => t.dueDate?.startsWith(format(calendarDate,'yyyy-MM'))).length} task{allTasks.filter(t => t.dueDate?.startsWith(format(calendarDate,'yyyy-MM'))).length !== 1 ? 's' : ''} this month</p>
                        </div>
                        <button onClick={() => setCalendarDate(d => addMonths(d, 1))}
                          className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-all font-bold text-lg">›</button>
                      </div>
                      {/* Day-of-week labels */}
                      <div className="grid grid-cols-7 border-b border-gray-100">
                        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                          <div key={d} className="py-2 text-center text-xs font-bold text-gray-400 uppercase tracking-wide">{d}</div>
                        ))}
                      </div>
                      {/* Day cells */}
                      <div className="grid grid-cols-7">
                        {days.map((day, idx) => {
                          const key      = format(day, 'yyyy-MM-dd')
                          const dayTasks = tasksByDate.get(key) || []
                          const dayAtt   = attendanceByDate.get(key) || []
                          const inMonth  = isSameMonth(day, calendarDate)
                          const today    = isToday(day)
                          const sel      = calendarSelectedDay && isSameDay(day, calendarSelectedDay)
                          const isWeekend = day.getDay() === 0 || day.getDay() === 6
                          return (
                            <div key={idx} onClick={() => setCalendarSelectedDay(sel ? null : day)}
                              className={`min-h-[80px] p-1.5 border-b border-r border-gray-50 cursor-pointer transition-all ${
                                !inMonth ? 'bg-gray-50/40' : isWeekend ? 'bg-blue-50/20' : 'bg-white'
                              } ${sel ? 'ring-2 ring-inset ring-[var(--dict-blue)] bg-blue-50' : 'hover:bg-blue-50/40'}`}>
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1 mx-auto ${
                                today ? 'bg-[var(--dict-blue)] text-white shadow-md' :
                                sel   ? 'bg-blue-100 text-blue-700' :
                                !inMonth ? 'text-gray-300' : isWeekend ? 'text-blue-400' : 'text-gray-700'
                              }`}>{format(day, 'd')}</div>
                              {dayTasks.length > 0 && (
                                <div className="flex flex-wrap gap-0.5 justify-center mb-0.5">
                                  {dayTasks.slice(0, 3).map((t, i) => (
                                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${PRIORITY_COLORS[t.priority] || 'bg-gray-400'}`} title={t.title}/>
                                  ))}
                                  {dayTasks.length > 3 && <span className="text-[9px] text-gray-400 font-bold">+{dayTasks.length - 3}</span>}
                                </div>
                              )}
                              {dayAtt.length > 0 && (
                                <div className="flex justify-center gap-0.5">
                                  {dayAtt.slice(0, 4).map((a, i) => {
                                    const m = ATTENDANCE_STATUS_META[a.status as AttendanceStatus]
                                    return <span key={i} className={`w-1.5 h-1.5 rounded-full ${m.color.split(' ')[0].replace('-100','-400')}`} title={m.label}/>
                                  })}
                                </div>
                              )}
                              {dayTasks.length > 0 && dayTasks.length <= 2 && (
                                <div className="space-y-0.5 mt-0.5">
                                  {dayTasks.map((t, i) => {
                                    const pm = PRIORITY_META[t.priority] || PRIORITY_META.MEDIUM
                                    return <p key={i} className={`text-[9px] font-semibold px-1 rounded truncate ${pm.color}`}>{t.title}</p>
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      {/* Legend */}
                      <div className="flex flex-wrap gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50">
                        {[
                          { color: 'bg-[var(--dict-blue)]', label: 'Today' },
                          { color: 'bg-gray-400',   label: 'Low' },
                          { color: 'bg-yellow-400', label: 'Medium' },
                          { color: 'bg-orange-500', label: 'High' },
                          { color: 'bg-red-500',    label: 'Urgent' },
                          { color: 'bg-green-400',  label: 'Present' },
                        ].map(l => (
                          <span key={l.label} className="text-xs text-gray-500 font-semibold flex items-center gap-1">
                            <span className={`w-2.5 h-2.5 rounded-full ${l.color}`}/>{l.label}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* ── Attendance Marquee (floating circles, infinite scroll) ── */}
                    {marqueeInterns.length > 0 && (
                      <div className="glass rounded-2xl overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                          <h3 className="font-display font-semibold text-gray-700 text-sm flex items-center gap-2">
                            <span className="w-5 h-5 bg-green-100 text-green-600 rounded-lg flex items-center justify-center text-xs">📋</span>
                            Attendance — Latest Records
                          </h3>
                          <button onClick={() => setShowAddAttendance(true)} className="text-xs text-green-600 font-bold hover:underline">+ Log</button>
                        </div>
                        <div className="relative overflow-hidden py-4">
                          <style>{`@keyframes marquee-scroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }`}</style>
                          <div className="flex gap-4 w-max" style={{ animation: `marquee-scroll ${Math.max(10, marqueeInterns.length * 3)}s linear infinite` }}>
                            {/* Duplicate the list for seamless loop */}
                            {[...marqueeInterns, ...marqueeInterns].map(({ intern, att }, idx) => {
                              const m = ATTENDANCE_STATUS_META[att.status as AttendanceStatus]
                              const sc = getSchoolColor(intern.school)
                              return (
                                <div key={idx}
                                  className={`flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group`}
                                  onClick={() => { setCalendarSelectedDay(new Date(att.date)); setCalendarDate(new Date(att.date)) }}>
                                  <div className="relative">
                                    <div className={`w-14 h-14 rounded-full border-3 border-white shadow-lg ring-2 ${sc.ring} overflow-hidden flex-shrink-0 group-hover:scale-110 transition-transform`}>
                                      {intern.photoUrl
                                        ? <img src={intern.photoUrl} alt={intern.fullName} className="w-full h-full object-cover"/>
                                        : <div className={`w-full h-full bg-gradient-to-br ${sc.grad} flex items-center justify-center text-white text-lg font-bold`}>
                                            {intern.fullName.split(' ').slice(0,2).map(w=>w[0]).join('')}
                                          </div>
                                      }
                                    </div>
                                    <span className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-xs shadow ${
                                      att.status === 'PRESENT' ? 'bg-green-500' :
                                      att.status === 'ABSENT'  ? 'bg-red-500'  :
                                      att.status === 'HALF_DAY'? 'bg-yellow-500' : 'bg-gray-400'
                                    }`}>{m.icon}</span>
                                  </div>
                                  <p className="text-[10px] font-semibold text-gray-700 text-center whitespace-nowrap max-w-[60px] truncate">{intern.fullName.split(' ')[0]}</p>
                                  <p className="text-[9px] text-gray-400 text-center">{format(new Date(att.date), 'MMM d')}</p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Right panel ── */}
                  <div className="space-y-4">
                    {/* TODAY summary — always at top */}
                    <div className="glass rounded-2xl overflow-hidden">
                      <div className="px-5 py-4 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white">
                        <p className="text-xs text-blue-200 font-semibold uppercase tracking-wider">Today</p>
                        <p className="font-display font-bold text-xl mt-0.5">{format(new Date(), 'MMMM d, yyyy')}</p>
                        <p className="text-blue-200 text-xs">{format(new Date(), 'EEEE')}</p>
                      </div>
                      <div className="p-3 grid grid-cols-2 gap-2">
                        {[
                          { label: 'Tasks Due', value: todayTasks.length,    color: 'bg-purple-50 text-purple-700' },
                          { label: 'Present',   value: todayAttendance.filter(a=>a.status==='PRESENT').length, color: 'bg-green-50 text-green-700' },
                          { label: 'Overdue',   value: overdueCount,          color: 'bg-red-50 text-red-700' },
                          { label: 'Active',    value: activeInterns.length,  color: 'bg-blue-50 text-blue-700' },
                        ].map(s => (
                          <div key={s.label} className={`p-3 rounded-xl text-center ${s.color}`}>
                            <p className="text-xl font-bold">{s.value}</p>
                            <p className="text-xs font-semibold mt-0.5">{s.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Today's tasks list */}
                    <div className="glass rounded-2xl overflow-hidden">
                      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-display font-semibold text-gray-800 flex items-center gap-2 text-sm">
                          <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center text-sm">📋</span>
                          Today's Tasks
                        </h3>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${todayTasks.length > 0 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'}`}>{todayTasks.length}</span>
                      </div>
                      {todayTasks.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-5">No tasks due today 🎉</p>
                      ) : (
                        <div className="p-3 space-y-2">
                          {todayTasks.map(t => {
                            const pm = PRIORITY_META[t.priority] || PRIORITY_META.MEDIUM
                            const tm = TASK_STATUS_META[t.status as TaskStatus]
                            return (
                              <div key={t.id} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                                <span className="text-sm mt-0.5">{tm.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-800 truncate">{t.title}</p>
                                  <p className="text-xs text-gray-400">{(t as any).internName}</p>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${pm.color}`}>{pm.label}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Selected day detail (when a day is clicked) */}
                    {calendarSelectedDay && (
                      <div className="glass rounded-2xl overflow-hidden">
                        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                          <div>
                            <p className="font-display font-semibold text-gray-800 text-sm">{format(calendarSelectedDay, 'MMMM d, yyyy')}</p>
                            <p className="text-xs text-gray-400">{format(calendarSelectedDay, 'EEEE')}</p>
                          </div>
                          <button onClick={() => setCalendarSelectedDay(null)} className="text-gray-300 hover:text-gray-500 text-lg font-bold">×</button>
                        </div>
                        <div className="p-3 space-y-2.5 max-h-[280px] overflow-y-auto">
                          {selectedTasks.length === 0 && selectedAttendance.length === 0 && (
                            <p className="text-center text-gray-400 text-sm py-4">No events on this day</p>
                          )}
                          {selectedTasks.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Tasks Due</p>
                              {selectedTasks.map(t => {
                                const pm = PRIORITY_META[t.priority] || PRIORITY_META.MEDIUM
                                return (
                                  <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-100 mb-1.5">
                                    <span className="text-sm">{TASK_STATUS_META[t.status as TaskStatus].icon}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold text-gray-800 truncate">{t.title}</p>
                                      <p className="text-[10px] text-gray-400">{(t as any).internName}</p>
                                    </div>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${pm.color}`}>{pm.label}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                          {selectedAttendance.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Attendance</p>
                              {selectedAttendance.map(a => {
                                const m = ATTENDANCE_STATUS_META[a.status as AttendanceStatus]
                                const intern = interns.find(i => i.attendance.some(x => x.id === a.id))
                                return (
                                  <div key={a.id} className={`flex items-center gap-2 p-2 rounded-lg border mb-1.5 ${m.color}`}>
                                    <Avatar name={intern?.fullName} photo={intern?.photoUrl} size="sm"/>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold truncate">{intern?.fullName || 'Unknown'}</p>
                                      {a.hours && <p className="text-[10px] opacity-70">{a.hours}h</p>}
                                    </div>
                                    <span className="text-xs font-bold">{m.icon}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ══ TIMELINE ═════════════════════════════════════════════════════════ */}
          {activeSection === 'timeline' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-display font-bold text-2xl text-gray-800">Intern Timeline</h1>
                  <p className="text-sm text-gray-500 mt-0.5">Grouped by status — click any card to view full profile</p>
                </div>
                <button onClick={() => setShowAddIntern(true)} className="px-4 py-2 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white rounded-xl text-sm font-bold shadow hover:shadow-lg transition-all">+ Add Intern</button>
              </div>

              {/* Status groups in defined order */}
              {([ 'ACTIVE', 'ON_LEAVE', 'INACTIVE', 'COMPLETED' ] as InternStatus[]).map(groupStatus => {
                const groupInterns = interns.filter(i => i.status === groupStatus)
                  .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                if (groupInterns.length === 0) return null
                const sm = INTERN_STATUS_META[groupStatus]
                const groupBg: Record<InternStatus, string> = {
                  ACTIVE:    'from-green-500 to-emerald-600',
                  COMPLETED: 'from-blue-500 to-indigo-600',
                  INACTIVE:  'from-gray-400 to-slate-500',
                  ON_LEAVE:  'from-yellow-500 to-amber-500',
                }
                const groupLight: Record<InternStatus, string> = {
                  ACTIVE:    'bg-green-50 border-green-200',
                  COMPLETED: 'bg-blue-50 border-blue-200',
                  INACTIVE:  'bg-gray-50 border-gray-200',
                  ON_LEAVE:  'bg-yellow-50 border-yellow-200',
                }
                return (
                  <div key={groupStatus} className="space-y-2">
                    {/* Group header */}
                    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r ${groupBg[groupStatus]} text-white shadow`}>
                      <span className={`w-2.5 h-2.5 rounded-full bg-white/70 flex-shrink-0`}/>
                      <span className="font-bold text-sm">{sm.label}</span>
                      <span className="text-xs bg-white/20 rounded-full px-2.5 py-0.5 font-bold">{groupInterns.length} intern{groupInterns.length !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Cards — profile left, details right */}
                    <div className="space-y-2 pl-2">
                      {groupInterns.map((intern) => {
                        const pct = Math.min(100, Math.round((intern.totalHours / intern.requiredHours) * 100))
                        const daysLeft = differenceInDays(new Date(intern.endDate), new Date())
                        const tasksDone = intern.tasks.filter(t => t.status === 'COMPLETED').length
                        const presentDays = intern.attendance.filter(a => a.status === 'PRESENT' || a.status === 'HALF_DAY').length
                        const sc = getSchoolColor(intern.school)
                        const dept = getDeptBadge(intern)
                        const elapsedPct = Math.min(100, Math.max(2,
                          differenceInDays(new Date(), new Date(intern.startDate)) /
                          Math.max(1, differenceInDays(new Date(intern.endDate), new Date(intern.startDate))) * 100
                        ))
                        return (
                          <div key={intern.id}
                            className={`glass rounded-2xl overflow-hidden border ${groupLight[groupStatus]} hover:shadow-lg transition-all cursor-pointer group`}
                            onClick={() => { setSelectedIntern(intern); setActiveSection('interns') }}>
                            <div className="flex items-stretch">
                              {/* Left — profile panel */}
                              <div className={`flex flex-col items-center justify-center gap-2 p-4 min-w-[110px] bg-gradient-to-b ${groupBg[groupStatus]} text-white`}>
                                <div className="relative">
                                  <Avatar name={intern.fullName} photo={intern.photoUrl} size="lg"/>
                                  <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${sm.dot}`}/>
                                </div>
                                <p className="text-xs font-bold text-center leading-tight text-white/90 max-w-[90px] truncate">{intern.fullName.split(' ')[0]}</p>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold bg-white/20 text-white border-white/30`}>{sm.label}</span>
                              </div>

                              {/* Right — details */}
                              <div className="flex-1 p-4 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="min-w-0">
                                    <p className="font-bold text-gray-800 truncate">{intern.fullName}</p>
                                    <p className="text-xs text-gray-500 truncate">{intern.course}</p>
                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                      <span className={`text-[10px] font-semibold ${sc.text} truncate`}>{intern.school}</span>
                                      {dept && <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-bold ${dept.color}`}>{dept.icon} {dept.short}</span>}
                                    </div>
                                  </div>
                                  <div className="flex gap-2 text-center flex-shrink-0">
                                    {[
                                      { v: presentDays, l: 'Days', c: 'text-green-600' },
                                      { v: `${tasksDone}/${intern.tasks.length}`, l: 'Tasks', c: 'text-purple-600' },
                                      { v: groupStatus === 'COMPLETED' ? '🎓' : daysLeft > 0 ? `${daysLeft}d` : `${Math.abs(daysLeft)}d`, l: groupStatus === 'COMPLETED' ? 'Done' : daysLeft > 0 ? 'Left' : 'Ended', c: daysLeft < 0 && groupStatus !== 'COMPLETED' ? 'text-red-500' : 'text-gray-700' },
                                    ].map(s => (
                                      <div key={s.l} className="bg-gray-50 rounded-lg px-2 py-1 text-center min-w-[40px]">
                                        <p className={`text-sm font-bold ${s.c}`}>{s.v}</p>
                                        <p className="text-[10px] text-gray-400">{s.l}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Hours progress */}
                                <div className="mb-2">
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-500">{Math.round(intern.totalHours)}h / {intern.requiredHours}h</span>
                                    <span className={`font-bold ${pct >= 100 ? 'text-green-600' : pct >= 70 ? 'text-blue-600' : 'text-orange-500'}`}>{pct}%</span>
                                  </div>
                                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-2 rounded-full bg-gradient-to-r ${pct >= 100 ? 'from-green-400 to-emerald-500' : pct >= 70 ? 'from-blue-400 to-indigo-500' : 'from-orange-400 to-red-400'}`}
                                      style={{ width: `${pct}%` }}/>
                                  </div>
                                </div>

                                {/* Timeline bar */}
                                <div>
                                  <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                                    <span>{format(new Date(intern.startDate), 'MMM d, yyyy')}</span>
                                    <span>{format(new Date(intern.endDate), 'MMM d, yyyy')}</span>
                                  </div>
                                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-1.5 rounded-full bg-gradient-to-r ${groupBg[groupStatus]}`} style={{ width: `${elapsedPct}%` }}/>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {interns.length === 0 && (
                <div className="glass rounded-2xl py-20 text-center">
                  <p className="text-5xl mb-4">⏳</p>
                  <p className="text-gray-500 font-medium">No interns yet</p>
                  <button onClick={() => setShowAddIntern(true)} className="mt-3 px-5 py-2 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white rounded-xl text-sm font-bold">+ Add First Intern</button>
                </div>
              )}
            </div>
          )}

          {/* ══ DOCUMENTS ════════════════════════════════════════════════════════ */}
          {activeSection === 'documents' && (() => {
            const DOC_FOLDERS = [
              { id: 'moa',        label: 'MOA / Endorsement',  icon: '📄', color: 'from-blue-500 to-indigo-500',   light: 'bg-blue-50 border-blue-200',   text: 'text-blue-700',   keys: ['moa','endorsement','letter'] },
              { id: 'id',         label: 'IDs & Identification', icon: '🪪', color: 'from-green-500 to-teal-500',  light: 'bg-green-50 border-green-200', text: 'text-green-700', keys: ['id','identification','school id'] },
              { id: 'report',     label: 'Reports & Output',   icon: '📝', color: 'from-purple-500 to-violet-500', light: 'bg-purple-50 border-purple-200',text: 'text-purple-700',keys: ['report','output','narrative'] },
              { id: 'assessment', label: 'Assessment Forms',   icon: '📋', color: 'from-orange-500 to-red-500',    light: 'bg-orange-50 border-orange-200',text: 'text-orange-700',keys: ['assessment','evaluation','form'] },
              { id: 'photo',      label: 'Photos & Media',     icon: '🖼️', color: 'from-pink-500 to-rose-500',     light: 'bg-pink-50 border-pink-200',   text: 'text-pink-700',  keys: ['image','photo','jpg','png'] },
              { id: 'other',      label: 'Other Files',        icon: '📁', color: 'from-gray-400 to-slate-500',    light: 'bg-gray-50 border-gray-200',   text: 'text-gray-700',  keys: [] },
            ]
            const allDocs = interns.flatMap(intern => intern.documents.map(d => ({ ...d, intern })))
            const getFolder = (doc: { name: string; type: string; url: string }) => {
              const hay = (doc.name + ' ' + doc.type).toLowerCase()
              for (const f of DOC_FOLDERS.slice(0, -1)) {
                if (f.keys.some(k => hay.includes(k))) return f.id
              }
              if (doc.type === 'Image' || doc.url.startsWith('data:image')) return 'photo'
              return 'other'
            }
            const totalFiles = allDocs.length
            return (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="font-display font-bold text-2xl text-gray-800">Documents</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{totalFiles} file{totalFiles !== 1 ? 's' : ''} across {interns.filter(i => i.documents.length > 0).length} intern{interns.filter(i => i.documents.length > 0).length !== 1 ? 's' : ''}</p>
                  </div>
                  <button onClick={() => setShowAddIntern(true)}
                    className="px-4 py-2 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all">
                    + Add Intern with Docs
                  </button>
                </div>

                {/* Folder grid */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {DOC_FOLDERS.map(folder => {
                    const folderDocs = allDocs.filter(d => getFolder(d) === folder.id)
                    if (folderDocs.length === 0) return null
                    const internCount = new Set(folderDocs.map(d => d.intern.id)).size
                    return (
                      <details key={folder.id} className="group glass rounded-2xl overflow-hidden">
                        <summary className={`flex items-center gap-3 p-4 cursor-pointer select-none hover:bg-gray-50 transition-all list-none border-b border-gray-100`}>
                          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${folder.color} flex items-center justify-center text-2xl flex-shrink-0 shadow-md`}>{folder.icon}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-800">{folder.label}</p>
                            <p className="text-xs text-gray-400">{folderDocs.length} file{folderDocs.length !== 1 ? 's' : ''} · {internCount} intern{internCount !== 1 ? 's' : ''}</p>
                          </div>
                          <span className="text-gray-300 group-open:rotate-90 transition-transform text-lg">›</span>
                        </summary>
                        {/* Per-intern sub-folders */}
                        <div className="p-3 space-y-3">
                          {Array.from(new Set(folderDocs.map(d => d.intern.id))).map(internId => {
                            const intern = interns.find(i => i.id === internId)!
                            const internDocs = folderDocs.filter(d => d.intern.id === internId)
                            const sc = getSchoolColor(intern.school)
                            return (
                              <details key={internId} className="group/intern">
                                <summary className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer list-none hover:${sc.light} transition-all border ${sc.border}`}>
                                  <Avatar name={intern.fullName} photo={intern.photoUrl} size="sm"/>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-bold ${sc.text} truncate`}>{intern.fullName}</p>
                                    <p className="text-xs text-gray-400">{internDocs.length} file{internDocs.length !== 1 ? 's' : ''}</p>
                                  </div>
                                  <span className="text-gray-300 group-open/intern:rotate-90 transition-transform">›</span>
                                </summary>
                                <div className="grid grid-cols-2 gap-2 mt-2 pl-2">
                                  {internDocs.map(doc => {
                                    const isImage = doc.type === 'Image' || doc.url.startsWith('data:image')
                                    const isPDF   = doc.type === 'PDF' || doc.url.startsWith('data:application/pdf')
                                    return (
                                      <div key={doc.id} className="group/doc rounded-xl border border-gray-100 overflow-hidden bg-white shadow-sm hover:shadow-md transition-all">
                                        {isImage ? (
                                          <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                            <div className="h-24 bg-gray-50 overflow-hidden">
                                              <img src={doc.url} alt={doc.name} className="w-full h-full object-cover hover:scale-105 transition-transform"/>
                                            </div>
                                          </a>
                                        ) : (
                                          <a href={doc.url} target="_blank" rel="noopener noreferrer"
                                            className="h-24 bg-gray-50 flex flex-col items-center justify-center gap-1.5 hover:bg-blue-50 transition-colors">
                                            <span className="text-3xl">{isPDF ? '📄' : '📎'}</span>
                                            <span className="text-xs font-semibold text-gray-400">{doc.type}</span>
                                          </a>
                                        )}
                                        <div className="p-2">
                                          <p className="text-xs font-semibold text-gray-800 truncate" title={doc.name}>{doc.name}</p>
                                          <p className="text-[10px] text-gray-400">{format(new Date(doc.createdAt), 'MMM d, yyyy')}</p>
                                          <div className="flex gap-1 mt-1.5">
                                            <a href={doc.url} download={doc.name} className="flex-1 text-center text-[10px] py-1 bg-blue-50 text-blue-600 rounded-lg font-semibold hover:bg-blue-100">↓</a>
                                            <button onClick={async () => {
                                              if (!confirm(`Delete "${doc.name}"?`)) return
                                              await fetch(`/api/interns/${intern.id}/documents?docId=${doc.id}`, { method: 'DELETE' })
                                              fetchInterns()
                                            }} className="px-2 text-[10px] py-1 bg-red-50 text-red-400 rounded-lg hover:bg-red-100">✕</button>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </details>
                            )
                          })}
                        </div>
                      </details>
                    )
                  })}
                </div>

                {totalFiles === 0 && (
                  <div className="glass rounded-2xl p-12 text-center border-2 border-dashed border-gray-200">
                    <p className="text-5xl mb-3">📁</p>
                    <p className="text-gray-600 font-semibold">No documents uploaded yet</p>
                    <p className="text-sm text-gray-400 mt-1">Attach files when adding a new intern — MOA, IDs, endorsement letters, etc.</p>
                    <button onClick={() => setShowAddIntern(true)} className="mt-4 px-5 py-2 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white rounded-xl text-sm font-bold">
                      + Add Intern with Documents
                    </button>
                  </div>
                )}
              </div>
            )
          })()}

          {/* ══ CERTIFICATES ═════════════════════════════════════════════════════ */}
          {activeSection === 'certificates' && (
            <div className="space-y-5">
              <div>
                <h1 className="font-display font-bold text-2xl text-gray-800">Certificate Generator</h1>
                <p className="text-sm text-gray-500 mt-0.5">Create and manage intern certificates</p>
              </div>

              <div className="glass rounded-2xl p-6 text-center">
                <p className="text-5xl mb-3">📜</p>
                <p className="text-gray-600 font-medium">Certificate system is being integrated</p>
                <p className="text-sm text-gray-400 mt-2">Advanced certificate designer with templates, bulk generation, and PDF export</p>
                <a href="/certificates" 
                  className="inline-block mt-4 px-6 py-2.5 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all">
                  Open Certificate Designer
                </a>
              </div>
            </div>
          )}

          {/* ══ REPORTS ══════════════════════════════════════════════════════════ */}
          {activeSection === 'reports' && (() => {
            // Build last-8-weeks hours data
            const weeks: { label: string; hours: number; tasks: number; present: number }[] = []
            for (let w = 7; w >= 0; w--) {
              const wStart = new Date(); wStart.setDate(wStart.getDate() - w * 7 - 6)
              const wEnd   = new Date(); wEnd.setDate(wEnd.getDate() - w * 7)
              const wHours = interns.flatMap(i => i.attendance).filter(a => {
                const d = new Date(a.date)
                return d >= wStart && d <= wEnd
              }).reduce((s, a) => s + (a.hours ?? 0), 0)
              const wTasks = allTasks.filter(t => {
                if (!t.dueDate) return false
                const d = new Date(t.dueDate)
                return d >= wStart && d <= wEnd && t.status === 'COMPLETED'
              }).length
              const wPresent = interns.flatMap(i => i.attendance).filter(a => {
                const d = new Date(a.date)
                return d >= wStart && d <= wEnd && (a.status === 'PRESENT' || a.status === 'HALF_DAY')
              }).length
              weeks.push({ label: format(wEnd, 'MMM d'), hours: Math.round(wHours * 10) / 10, tasks: wTasks, present: wPresent })
            }
            const maxHours = Math.max(...weeks.map(w => w.hours), 1)

            const exportReport = () => {
              const rows = [
                ['Week Ending', 'Hours Logged', 'Present Days', 'Tasks Completed'],
                ...weeks.map(w => [w.label, w.hours, w.present, w.tasks]),
                [],
                ['Intern', 'Status', 'School', 'Course', 'Hours Logged', 'Required Hours', 'Progress %', 'Days Present', 'Tasks Done', 'Start Date', 'End Date'],
                ...interns.map(i => [
                  i.fullName,
                  INTERN_STATUS_META[i.status].label,
                  i.school,
                  i.course,
                  Math.round(i.totalHours),
                  i.requiredHours,
                  `${Math.min(100, Math.round((i.totalHours / i.requiredHours) * 100))}%`,
                  i.attendance.filter(a => a.status === 'PRESENT' || a.status === 'HALF_DAY').length,
                  i.tasks.filter(t => t.status === 'COMPLETED').length,
                  format(new Date(i.startDate), 'MMM d, yyyy'),
                  format(new Date(i.endDate), 'MMM d, yyyy'),
                ]),
              ]
              const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
              const blob = new Blob([csv], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = `intern-report-${format(new Date(), 'yyyy-MM-dd')}.csv`
              a.click(); URL.revokeObjectURL(url)
            }

            return (
              <div className="space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h1 className="font-display font-bold text-2xl text-gray-800">Reports & Analytics</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Internship program performance and weekly accomplishments</p>
                  </div>
                  <button onClick={exportReport}
                    className="px-4 py-2 border-2 border-green-400 text-green-700 rounded-xl text-sm font-bold hover:bg-green-50 transition-all flex items-center gap-2">
                    ↓ Export CSV Report
                  </button>
                </div>

                {/* KPI cards */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Completion Rate', value: interns.length > 0 ? `${Math.round((interns.filter(i=>i.status==='COMPLETED').length/interns.length)*100)}%` : '0%', icon: '🎓', color: 'from-blue-500 to-indigo-600', sub: `${interns.filter(i=>i.status==='COMPLETED').length} completed` },
                    { label: 'Avg Hours / Intern', value: interns.length > 0 ? `${Math.round(totalHoursLogged/interns.length)}h` : '0h', icon: '⏱️', color: 'from-green-500 to-emerald-600', sub: `${Math.round(totalHoursLogged)}h total` },
                    { label: 'Task Completion', value: allTasks.length > 0 ? `${Math.round((allTasks.filter(t=>t.status==='COMPLETED').length/allTasks.length)*100)}%` : 'N/A', icon: '✅', color: 'from-purple-500 to-purple-700', sub: `${allTasks.filter(t=>t.status==='COMPLETED').length}/${allTasks.length} tasks` },
                    { label: 'Attendance Rate', value: (() => { const total = interns.flatMap(i=>i.attendance).length; const present = interns.flatMap(i=>i.attendance).filter(a=>a.status==='PRESENT'||a.status==='HALF_DAY').length; return total > 0 ? `${Math.round((present/total)*100)}%` : 'N/A' })(), icon: '📅', color: 'from-orange-500 to-red-500', sub: 'present days / total' },
                  ].map(c => (
                    <div key={c.label} className="glass rounded-2xl p-5">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-xl mb-3 shadow-md`}>{c.icon}</div>
                      <p className="text-3xl font-display font-bold text-gray-800">{c.value}</p>
                      <p className="font-semibold text-gray-700 mt-0.5 text-sm">{c.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Weekly bar chart */}
                <div className="glass rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display font-semibold text-gray-800 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-sm">📊</span>
                      Weekly Accomplishments — Hours Logged
                    </h2>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gradient-to-t from-blue-600 to-blue-400 inline-block"/> Hours</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gradient-to-t from-green-500 to-emerald-400 inline-block"/> Present</span>
                    </div>
                  </div>
                  <div className="flex items-end gap-2 h-44 overflow-x-auto pb-1">
                    {weeks.map((w, i) => {
                      const hPct = (w.hours / maxHours) * 100
                      const pPct = (w.present / Math.max(...weeks.map(x => x.present), 1)) * 100
                      const isCurrent = i === weeks.length - 1
                      return (
                        <div key={w.label} className="flex-1 min-w-[50px] flex flex-col items-center gap-1 group">
                          {/* Value labels */}
                          <div className="text-[10px] font-bold text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">{w.hours}h</div>
                          {/* Bars */}
                          <div className="w-full flex items-end gap-0.5 h-32">
                            <div className={`flex-1 rounded-t-lg transition-all bg-gradient-to-t ${isCurrent ? 'from-blue-700 to-blue-400' : 'from-blue-500 to-blue-300'} opacity-90 hover:opacity-100`}
                              style={{ height: `${Math.max(4, hPct)}%` }}
                              title={`${w.hours}h logged`}/>
                            <div className="flex-1 rounded-t-lg transition-all bg-gradient-to-t from-green-500 to-emerald-300 opacity-80 hover:opacity-100"
                              style={{ height: `${Math.max(4, pPct)}%` }}
                              title={`${w.present} present`}/>
                          </div>
                          {/* X label */}
                          <p className={`text-[9px] font-semibold text-center truncate w-full ${isCurrent ? 'text-blue-600' : 'text-gray-400'}`}>{w.label}</p>
                          {/* Tasks completed badge */}
                          {w.tasks > 0 && <span className="text-[9px] bg-purple-100 text-purple-600 rounded-full px-1 font-bold">{w.tasks}✓</span>}
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-right">Hover bars to see values · Purple badge = tasks completed that week</p>
                </div>

                {/* Per-intern summary table */}
                <div className="glass rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-display font-semibold text-gray-800">Individual Intern Reports</h2>
                    <span className="text-xs text-gray-400">{interns.length} intern{interns.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          {['Intern','Status','School','Progress','Days','Tasks','Days Left'].map(h => (
                            <th key={h} className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {interns.map(intern => {
                          const sm = INTERN_STATUS_META[intern.status]
                          const pct = Math.min(100, Math.round((intern.totalHours / intern.requiredHours) * 100))
                          const tasksDone = intern.tasks.filter(t => t.status === 'COMPLETED').length
                          const daysPresent = intern.attendance.filter(a => a.status === 'PRESENT' || a.status === 'HALF_DAY').length
                          const daysLeft = differenceInDays(new Date(intern.endDate), new Date())
                          const dept = getDeptBadge(intern)
                          const sc = getSchoolColor(intern.school)
                          const isCompleted = intern.status === 'COMPLETED'
                          return (
                            <tr key={intern.id} className={`hover:bg-gray-50 transition-colors cursor-pointer ${isCompleted ? 'bg-green-50/40' : ''}`}
                              onClick={() => { setSelectedIntern(intern); setActiveSection('interns') }}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <Avatar name={intern.fullName} photo={intern.photoUrl} size="sm"/>
                                  <div className="min-w-0">
                                    <p className="font-bold text-gray-800 truncate text-sm">{intern.fullName}</p>
                                    <p className="text-xs text-gray-400 truncate">{intern.course}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap ${sm.badge}`}>{sm.label}</span>
                              </td>
                              <td className="px-4 py-3">
                                <p className={`text-xs font-semibold ${sc.text} truncate max-w-[120px]`}>{intern.school}</p>
                                {dept && <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-bold mt-0.5 inline-block ${dept.color}`}>{dept.icon} {dept.short}</span>}
                              </td>
                              <td className="px-4 py-3 min-w-[130px]">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-gray-500">{Math.round(intern.totalHours)}h/{intern.requiredHours}h</span>
                                  <span className={`font-bold ${pct>=100?'text-green-600':pct>=70?'text-blue-600':'text-orange-500'}`}>{pct}%</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-1.5 rounded-full bg-gradient-to-r ${pct>=100?'from-green-400 to-emerald-500':pct>=70?'from-blue-400 to-indigo-500':'from-orange-400 to-red-400'}`} style={{width:`${pct}%`}}/>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <p className="font-bold text-gray-800">{daysPresent}</p>
                                <p className="text-xs text-gray-400">present</p>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <p className="font-bold text-gray-800">{tasksDone}/{intern.tasks.length}</p>
                                <p className="text-xs text-gray-400">done</p>
                              </td>
                              <td className="px-4 py-3">
                                {isCompleted ? <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">🎓 Done</span>
                                  : daysLeft > 7 ? <span className="text-sm font-bold text-gray-700">{daysLeft}d</span>
                                  : daysLeft > 0 ? <span className="text-sm font-bold text-orange-600 animate-pulse">{daysLeft}d!</span>
                                  : <span className="text-xs font-bold text-red-600">{Math.abs(daysLeft)}d ago</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {interns.length === 0 && <p className="text-center text-gray-400 py-8">No intern data available</p>}
                  </div>
                </div>
              </div>
            )
          })()}
        </main>
      </div>
    </div>
  )
}
