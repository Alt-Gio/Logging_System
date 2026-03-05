'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { usePusher } from '@/lib/usePusher'
import { GovSeal, GovHeaderLogos } from '@/components/GovernmentHeader'
import { format, formatDistanceToNow, isToday, differenceInMinutes } from 'date-fns'

// ─── Types ─────────────────────────────────────────────────────────────────────
type PCStatus = 'ONLINE' | 'OFFLINE' | 'IN_USE' | 'MAINTENANCE'
type PC = {
  id: string; name: string; ipAddress: string; location: string | null
  status: PCStatus; lastSeen: string | null; isActive: boolean; ssid: string | null
  specs?: string | null; gridCol?: number | null; gridRow?: number | null; icon?: string | null
  logs?: { id: string; fullName: string; agency: string; timeIn: string; photoDataUrl?: string | null; plannedDurationHours?: number }[]
}
type Log = {
  id: string; fullName: string; agency: string; purpose: string
  equipmentUsed: string[]; timeIn: string; timeOut: string | null
  signature: string | null; photoDataUrl: string | null; plannedDurationHours: number
  archived?: boolean
  pc?: { name: string; ipAddress: string } | null
}
type DashView = 'recent' | 'today' | 'active'

const EQUIPMENT_OPTIONS = ['Desktop Computer', 'Internet Only']
const PC_ICONS = ['🖥️','💻','🖱️','⌨️','🖨️','📡','🔵','🟢','⭐','🏢']
const STATUS_META: Record<PCStatus, { label: string; dot: string; badge: string }> = {
  ONLINE:      { label: 'Available',   dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700 border-green-300' },
  OFFLINE:     { label: 'Offline',     dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-500 border-gray-300' },
  IN_USE:      { label: 'In Use',      dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700 border-orange-300' },
  MAINTENANCE: { label: 'Maintenance', dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
}

// ─── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, photo, size = 'md' }: { name: string; photo?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-lg' : 'w-10 h-10 text-sm'
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  if (photo) return <img src={photo} className={`${sz} rounded-full object-cover flex-shrink-0 border-2 border-white shadow-sm`} alt={name}/>
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm`}>
      {initials}
    </div>
  )
}

// ─── Bar Chart ─────────────────────────────────────────────────────────────────
function BarChart({ data, title, color = 'bg-[var(--dict-blue)]' }: { data: { label: string; value: number }[]; title: string; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</p>
      <div className="space-y-2">
        {data.map(d => (
          <div key={d.label} className="flex items-center gap-3">
            <div className="w-36 text-xs text-gray-600 truncate text-right flex-shrink-0">{d.label}</div>
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
              <div className={`${color} h-5 rounded-full flex items-center justify-end pr-2 transition-all`}
                style={{ width: `${Math.max(8, (d.value / max) * 100)}%` }}>
                <span className="text-white text-xs font-bold">{d.value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Log Entry Card ─────────────────────────────────────────────────────────────
function LogCard({ log, onEdit, onCheckout, compact = false }: {
  log: Log; onEdit: (l: Log) => void; onCheckout: (id: string) => void; compact?: boolean
}) {
  const isActive = !log.timeOut
  const expectedOut = new Date(new Date(log.timeIn).getTime() + log.plannedDurationHours * 3600000)
  const isOverdue = isActive && new Date() > expectedOut
  return (
    <div onClick={() => onEdit(log)}
      className="bg-white rounded-xl border border-gray-100 p-4 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group">
      <div className="flex items-start gap-3">
        <Avatar name={log.fullName} photo={log.photoDataUrl} size={compact ? 'sm' : 'md'}/>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 text-sm truncate">{log.fullName}</p>
              <p className="text-xs text-gray-400 truncate">{log.agency}</p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {isActive
                ? <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                    {isOverdue ? '⚠ Overdue' : '● Active'}
                  </span>
                : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Done</span>
              }
            </div>
          </div>
          {!compact && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-1">{log.purpose}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span>⏰ {format(new Date(log.timeIn), 'hh:mm a')}</span>
            {log.timeOut && <span>→ {format(new Date(log.timeOut), 'hh:mm a')}</span>}
            {isActive && <span className="text-blue-500">out by {format(expectedOut, 'hh:mm a')}</span>}
            {log.pc && <span className="text-blue-400">📍 {log.pc.name}</span>}
          </div>
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {log.equipmentUsed.map(e => (
              <span key={e} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md">{e}</span>
            ))}
          </div>
        </div>
      </div>
      {isActive && (
        <div className="mt-3 pt-3 border-t border-gray-50 flex gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={() => onCheckout(log.id)}
            className="flex-1 text-xs py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 font-semibold transition-colors">
            ✓ Check Out
          </button>
          <button onClick={() => onEdit(log)}
            className="text-xs py-1.5 px-3 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
            ✏ Edit
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Edit Log Modal ─────────────────────────────────────────────────────────────
function EditLogModal({ log, onSave, onClose, onCheckout }: {
  log: Log; onSave: (id: string, data: Partial<Log>) => void
  onClose: () => void; onCheckout: (id: string) => void
}) {
  const [form, setForm] = useState({
    fullName: log.fullName, agency: log.agency, purpose: log.purpose,
    equipmentUsed: [...log.equipmentUsed], plannedDurationHours: log.plannedDurationHours,
    timeIn: format(new Date(log.timeIn), "yyyy-MM-dd'T'HH:mm"),
    timeOut: log.timeOut ? format(new Date(log.timeOut), "yyyy-MM-dd'T'HH:mm") : '',
  })
  const isActive = !log.timeOut
  const expectedOut = new Date(new Date(log.timeIn).getTime() + log.plannedDurationHours * 3600000)
  const isOverdue = isActive && new Date() > expectedOut
  const duration = log.timeOut
    ? Math.round(differenceInMinutes(new Date(log.timeOut), new Date(log.timeIn)))
    : Math.round(differenceInMinutes(new Date(), new Date(log.timeIn)))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[var(--dict-blue)] px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={log.fullName} photo={log.photoDataUrl} size="md"/>
              <div>
                <h3 className="font-display font-bold text-white text-lg leading-tight">{log.fullName}</h3>
                <p className="text-blue-200 text-xs">{log.agency}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isActive
                ? <span className={`text-xs px-3 py-1 rounded-full font-bold ${isOverdue ? 'bg-red-400 text-white' : 'bg-green-400 text-white'}`}>
                    {isOverdue ? '⚠ Overdue' : '● Active'}
                  </span>
                : <span className="text-xs px-3 py-1 rounded-full bg-white/20 text-white font-semibold">Completed</span>
              }
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors">✕</button>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex gap-6 flex-shrink-0 overflow-x-auto">
          {[
            { label: 'Time In', val: format(new Date(log.timeIn), 'hh:mm a') },
            { label: 'Time Out', val: log.timeOut ? format(new Date(log.timeOut), 'hh:mm a') : 'Active' },
            { label: 'Duration', val: `${duration}m` },
            { label: 'Planned', val: `${log.plannedDurationHours}h` },
            { label: 'Station', val: log.pc?.name || '—' },
          ].map(s => (
            <div key={s.label} className="flex-shrink-0">
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="font-bold text-gray-800 text-sm">{s.val}</p>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Full Name</label>
              <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Agency</label>
              <input value={form.agency} onChange={e => setForm(f => ({ ...f, agency: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Purpose</label>
            <textarea value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
              rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] resize-none"/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Time In</label>
              <input type="datetime-local" value={form.timeIn}
                onChange={e => setForm(f => ({ ...f, timeIn: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] font-mono"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Time Out {isActive && <span className="text-green-500 ml-1">(currently active)</span>}</label>
              <input type="datetime-local" value={form.timeOut}
                onChange={e => setForm(f => ({ ...f, timeOut: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] font-mono"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Planned Duration (hrs)</label>
              <input type="number" min="0.25" max="8" step="0.25" value={form.plannedDurationHours}
                onChange={e => setForm(f => ({ ...f, plannedDurationHours: parseFloat(e.target.value) }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Equipment Used</label>
              <div className="flex gap-2 pt-1">
                {EQUIPMENT_OPTIONS.map(opt => {
                  const sel = form.equipmentUsed.includes(opt)
                  return (
                    <button key={opt} type="button"
                      onClick={() => setForm(f => ({ ...f, equipmentUsed: sel ? f.equipmentUsed.filter(e => e !== opt) : [...f.equipmentUsed, opt] }))}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${sel ? 'bg-[var(--dict-blue)] text-white border-[var(--dict-blue)]' : 'border-gray-200 text-gray-600 hover:border-blue-200'}`}>
                      {opt}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-gray-100 px-6 py-4 flex gap-3 flex-shrink-0">
          {isActive && (
            <button onClick={() => { onCheckout(log.id); onClose() }}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors">
              ✓ Check Out Now
            </button>
          )}
          <button onClick={onClose} className="py-2.5 px-5 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(log.id, { ...form, timeIn: new Date(form.timeIn).toISOString(), timeOut: form.timeOut ? new Date(form.timeOut).toISOString() : null })}
            className="flex-1 py-2.5 bg-[var(--dict-blue)] text-white rounded-xl text-sm font-bold hover:bg-blue-800 transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit PC Modal ──────────────────────────────────────────────────────────────
function EditPcModal({ pc, onSave, onClose }: {
  pc: PC; onSave: (id: string, data: Partial<PC>) => void; onClose: () => void
}) {
  const [form, setForm] = useState({
    name: pc.name, ipAddress: pc.ipAddress, location: pc.location || '',
    status: pc.status, ssid: pc.ssid || '', specs: pc.specs || '',
    gridCol: pc.gridCol ?? 1, gridRow: pc.gridRow ?? 1, icon: pc.icon || '🖥️',
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-[var(--dict-blue)] px-6 py-4 flex items-center justify-between">
          <h3 className="font-display font-bold text-white text-lg">Edit Workstation — {pc.name}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30">✕</button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Icon picker */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-2">Station Icon</label>
            <div className="flex gap-2 flex-wrap">
              {PC_ICONS.map(ic => (
                <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))}
                  className={`w-10 h-10 rounded-xl text-xl border-2 transition-all ${form.icon === ic ? 'border-[var(--dict-blue)] bg-blue-50' : 'border-gray-200 hover:border-blue-200'}`}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Station Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">IP Address</label>
              <input value={form.ipAddress} onChange={e => setForm(f => ({ ...f, ipAddress: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-[var(--dict-blue)]"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Location / Area</label>
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as PCStatus }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]">
                <option value="ONLINE">Online (Available)</option>
                <option value="OFFLINE">Offline (Not in service)</option>
                <option value="IN_USE">In Use</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Grid Column</label>
              <input type="number" min="1" max="10" value={form.gridCol}
                onChange={e => setForm(f => ({ ...f, gridCol: parseInt(e.target.value) }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Grid Row</label>
              <input type="number" min="1" max="10" value={form.gridRow}
                onChange={e => setForm(f => ({ ...f, gridRow: parseInt(e.target.value) }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">WiFi SSID (if applicable)</label>
            <input value={form.ssid} onChange={e => setForm(f => ({ ...f, ssid: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-[var(--dict-blue)]"/>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Specs / Notes</label>
            <textarea value={form.specs} onChange={e => setForm(f => ({ ...f, specs: e.target.value }))}
              rows={3} placeholder="e.g. Core i5, 8GB RAM, Win11, 22&quot; monitor..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] resize-none"/>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="py-2.5 px-5 border border-gray-200 text-gray-500 rounded-xl text-sm">Cancel</button>
          <button onClick={() => onSave(pc.id, form)} className="flex-1 py-2.5 bg-[var(--dict-blue)] text-white rounded-xl text-sm font-bold">Save Changes</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Admin Component ───────────────────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [currentAdmin, setCurrentAdmin] = useState<{id:string;name:string;role:string} | null>(null)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [tab, setTab] = useState<'dashboard' | 'logs' | 'pcs' | 'network' | 'settings' | 'security' | 'auditlog' | 'announcements' | 'analytics' | 'admins'>('dashboard')
  const [settings, setSettings] = useState({ wifiSsid: 'DICT-DTC-Free', wifiPassword: '', wifiNote: 'Free public WiFi', accessCode: '1234', officeOpen: '08:00', officeClose: '17:00' })
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [allLogs, setAllLogs] = useState<Log[]>([])
  const [pcs, setPcs] = useState<PC[]>([])
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [dashView, setDashView] = useState<DashView>('recent')
  const [editLog, setEditLog] = useState<Log | null>(null)
  const [editingPc, setEditingPc] = useState<PC | null>(null)
  const [newPc, setNewPc] = useState({ name: '', ipAddress: '', location: '' })
  const [pingingId, setPingingId] = useState<string | null>(null)
  const [pingAllLoading, setPingAllLoading] = useState(false)
  const [ipSearch, setIpSearch] = useState('')
  const [ipResult, setIpResult] = useState<{ ip: string; alive: boolean; responseTime: number | null; pcName?: string | null } | null>(null)
  const [ipLoading, setIpLoading] = useState(false)
  const [scanConfig, setScanConfig] = useState({ baseIp: '192.168.1', start: '1', end: '30' })
  const [scanning, setScanning] = useState(false)
  const [scanResults, setScanResults] = useState<{ ip: string; alive: boolean; responseTime: number | null }[]>([])
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  // ── Pusher real-time + browser notifications ──────────────────────────────
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default')
  useEffect(() => {
    if (typeof Notification !== 'undefined') setNotifPermission(Notification.permission)
  }, [])

  const requestNotifications = () => {
    Notification.requestPermission().then(p => setNotifPermission(p))
  }

  const sendNotif = (title: string, body: string, urgent = false) => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/dict-seal.png', badge: '/dict-seal.png', tag: urgent ? 'urgent' : 'info' })
    }
  }

  usePusher({
    onLogCreated: (data: unknown) => {
      const d = data as { fullName: string; pcName?: string }
      fetchLogs(); fetchStats()
      sendNotif('New Client Logged In', `${d.fullName}${d.pcName ? ' · ' + d.pcName : ''}`)
    },
    onLogUpdated: () => { fetchLogs(); fetchPcs() },
    onLogArchived: () => { fetchLogs(); fetchStats() },
    onPcUpdated: () => { fetchPcs() },
    onSessionExpiry: (data: unknown) => {
      const d = data as { fullName: string; pcName?: string }
      fetchLogs(); fetchPcs(); fetchStats()
      sendNotif('⏰ Session Auto-Ended', `${d.fullName}'s session has expired${d.pcName ? ' — ' + d.pcName + ' is now free' : ''}`, true)
    },
  })

  // Grid floor plan settings
  const [gridCols, setGridCols] = useState(5)
  const [gridRowCount, setGridRowCount] = useState(4)
  const [showGridSettings, setShowGridSettings] = useState(false)
  // Security / IP cameras — DB backed
  const [cameras, setCameras] = useState<{id:string;name:string;url:string;type:string;enabled:boolean;notes:string|null}[]>([])
  const [newCamera, setNewCamera] = useState({name:'',url:'',type:'MJPEG',notes:''})
  const [cameraRefreshKey, setCameraRefreshKey] = useState(0)
  const [expandedCam, setExpandedCam] = useState<string|null>(null)

  // ── Data fetching ─────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    const r = await fetch('/api/stats'); if (r.ok) setStats(await r.json())
  }, [])
  const fetchLogs = useCallback(async () => {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (dateFilter) p.set('date', dateFilter)
    p.set('limit', '200')
    const r = await fetch(`/api/logs?${p}`)
    if (r.ok) { const d = await r.json(); setAllLogs(d.logs || []) }
  }, [search, dateFilter])
  const fetchPcs = useCallback(async () => {
    const r = await fetch('/api/pcs'); if (r.ok) setPcs(await r.json())
  }, [])
  const fetchSettings = async () => {
    const r = await fetch('/api/settings'); if (r.ok) setSettings(await r.json())
  }

  useEffect(() => {
    // Verify session with server on every page load — don't just trust sessionStorage
    fetch('/api/auth', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.authenticated) {
          setAuthed(true)
          setCurrentAdmin(d.admin)
          sessionStorage.setItem('dict_admin', '1')
          sessionStorage.setItem('dict_admin_info', JSON.stringify(d.admin))
        } else {
          // Token expired or invalid
          sessionStorage.removeItem('dict_admin')
          sessionStorage.removeItem('dict_admin_info')
          setAuthed(false)
        }
      })
      .catch(() => {
        // Network error — trust sessionStorage as fallback for offline resilience
        if (typeof window !== 'undefined' && sessionStorage.getItem('dict_admin')) {
          setAuthed(true)
          try { const a = sessionStorage.getItem('dict_admin_info'); if (a) setCurrentAdmin(JSON.parse(a)) } catch {}
        }
      })
  }, [])
  useEffect(() => {
    if (!authed) return
    fetchStats(); fetchPcs(); fetchSettings(); fetchLogs()
    const t = setInterval(() => { fetchStats(); fetchPcs() }, 30000)
    return () => clearInterval(t)
  }, [authed, fetchStats, fetchPcs, fetchLogs])
  useEffect(() => { if (authed && tab === 'logs') fetchLogs() }, [authed, tab, fetchLogs])

  // ── Derived data ──────────────────────────────────────────────────────────────
  const todayLogs = useMemo(() => allLogs.filter(l => isToday(new Date(l.timeIn))), [allLogs])
  const activeLogs = useMemo(() => allLogs.filter(l => !l.timeOut), [allLogs])
  const recentLogs = useMemo(() => allLogs.slice(0, 12), [allLogs])
  const dashLogs = dashView === 'today' ? todayLogs : dashView === 'active' ? activeLogs : recentLogs

  // Purpose frequency chart
  const purposeFreq = useMemo(() => {
    const freq: Record<string, number> = {}
    allLogs.forEach(l => {
      const key = l.purpose.split(' ').slice(0, 4).join(' ')
      freq[key] = (freq[key] || 0) + 1
    })
    return Object.entries(freq).map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8)
  }, [allLogs])

  const equipmentFreq = useMemo(() => {
    const freq: Record<string, number> = {}
    allLogs.forEach(l => l.equipmentUsed.forEach(e => { freq[e] = (freq[e] || 0) + 1 }))
    return Object.entries(freq).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [allLogs])

  const agencyFreq = useMemo(() => {
    const freq: Record<string, number> = {}
    allLogs.forEach(l => { freq[l.agency] = (freq[l.agency] || 0) + 1 })
    return Object.entries(freq).map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8)
  }, [allLogs])

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setLoginError('')
    const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loginForm) })
    if (r.ok) {
      const d = await r.json()
      sessionStorage.setItem('dict_admin', '1')
      sessionStorage.setItem('dict_admin_info', JSON.stringify(d.admin))
      setCurrentAdmin(d.admin)
      setAuthed(true)
    }
    else setLoginError('Invalid username or password')
  }
  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' }); sessionStorage.removeItem('dict_admin'); setAuthed(false)
  }
  const handleCheckout = async (logId: string) => {
    await fetch(`/api/logs/${logId}/timeout`, { method: 'PATCH' })
    fetchLogs(); fetchStats(); fetchPcs()
  }
  const handleSaveLog = async (id: string, data: Partial<Log>) => {
    await fetch(`/api/logs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    setEditLog(null); fetchLogs(); fetchStats()
  }
  const archiveLog = async (id: string) => {
    await fetch(`/api/logs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: true }) })
    fetchLogs(); fetchStats()
  }
  const handleSavePc = async (id: string, data: Partial<PC>) => {
    await fetch(`/api/pcs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    setEditingPc(null); fetchPcs()
  }
  const addPc = async () => {
    if (!newPc.name || !newPc.ipAddress) return
    await fetch('/api/pcs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPc) })
    setNewPc({ name: '', ipAddress: '', location: '' }); fetchPcs()
  }
  const deletePc = async (id: string) => {
    if (!confirm('Delete this workstation?')) return
    await fetch(`/api/pcs/${id}`, { method: 'DELETE' }); fetchPcs()
  }
  const pingPc = async (pc: PC) => {
    setPingingId(pc.id); await fetch(`/api/network/ping?ip=${pc.ipAddress}`); await fetchPcs(); setPingingId(null)
  }
  const pingAll = async () => {
    setPingAllLoading(true)
    await fetch('/api/network/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pingAll: true }) })
    await fetchPcs(); setPingAllLoading(false)
  }
  const searchIp = async () => {
    if (!ipSearch.trim()) return; setIpLoading(true); setIpResult(null)
    const r = await fetch(`/api/network/ping?ip=${ipSearch.trim()}`)
    if (r.ok) setIpResult(await r.json()); setIpLoading(false); fetchPcs()
  }
  const handleScan = async () => {
    setScanning(true); setScanResults([])
    const r = await fetch('/api/network/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseIp: scanConfig.baseIp, startOctet: parseInt(scanConfig.start), endOctet: parseInt(scanConfig.end) }) })
    if (r.ok) { const d = await r.json(); setScanResults(d.hosts || []) }
    await fetchPcs(); setScanning(false)
  }
  const saveSettings = async () => {
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
    setSettingsSaved(true); try { localStorage.removeItem('dtc_settings_cache') } catch {}
    setTimeout(() => setSettingsSaved(false), 3000)
  }

  // Drag and drop for PC grid
  const handleDrop = async (targetId: string) => {
    if (!draggingId || draggingId === targetId) { setDraggingId(null); setDragOverId(null); return }
    const src = pcs.find(p => p.id === draggingId)
    const tgt = pcs.find(p => p.id === targetId)
    if (!src || !tgt) return
    // Swap grid positions
    await fetch(`/api/pcs/${draggingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gridCol: tgt.gridCol, gridRow: tgt.gridRow }) })
    await fetch(`/api/pcs/${targetId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gridCol: src.gridCol, gridRow: src.gridRow }) })
    setDraggingId(null); setDragOverId(null); fetchPcs()
  }

  // Camera helpers — DB backed
  const fetchCameras = useCallback(async () => {
    try { const r = await fetch('/api/cameras'); setCameras(await r.json()) } catch {}
  }, [])
  useEffect(() => { fetchCameras() }, [fetchCameras])
  const addCamera = async () => {
    if (!newCamera.name || !newCamera.url) return
    await fetch('/api/cameras', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newCamera) })
    setNewCamera({ name:'', url:'', type:'MJPEG', notes:'' })
    fetchCameras()
  }
  const removeCamera = async (id: string) => {
    await fetch(`/api/cameras/${id}`, { method:'DELETE' })
    if (expandedCam === id) setExpandedCam(null)
    fetchCameras()
  }
  const toggleCamera = async (id: string) => {
    const cam = cameras.find(c => c.id === id)
    if (!cam) return
    await fetch(`/api/cameras/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ enabled: !cam.enabled }) })
    fetchCameras()
  }

  const s = stats as Record<string, unknown> | null

  // ── LOGIN ──────────────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-[var(--dict-blue)] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-[var(--dict-blue)] flex items-center justify-center mx-auto mb-3 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <h1 className="font-display font-bold text-xl text-[var(--dict-blue)]">Staff Portal</h1>
            <p className="text-sm text-gray-400">DTC Region V · Administration</p>
          </div>
          <div className="space-y-3">
            <input type="text" value={loginForm.username} onChange={e => setLoginForm(f => ({ ...f, username: e.target.value }))} placeholder="Username"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--dict-blue)]"/>
            <input type="password" value={loginForm.password} onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="Password"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--dict-blue)]"/>
            {loginError && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{loginError}</p>}
            <button onClick={handleLogin} className="w-full py-3 bg-[var(--dict-blue)] text-white rounded-xl font-semibold hover:bg-blue-800">Login</button>
          </div>
          <div className="mt-4 text-center"><a href="/" className="text-xs text-gray-400 hover:text-gray-600">← Back to Logbook</a></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-cream)]">
      {/* Edit Log Modal */}
      {editLog && <EditLogModal log={editLog} onSave={handleSaveLog} onClose={() => setEditLog(null)} onCheckout={handleCheckout}/>}
      {/* Edit PC Modal */}
      {editingPc && <EditPcModal pc={editingPc} onSave={handleSavePc} onClose={() => setEditingPc(null)}/>}

      {/* ── Government Header ── */}
      <header className="bg-[var(--dict-blue)] shadow-lg">
        <div className="flex h-1.5">
          <div className="flex-1 bg-[#0038A8]"/><div className="flex-1 bg-[#CE1126]"/><div className="flex-1 bg-[#FCD116]"/>
        </div>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-3">
              <GovSeal/>
              <div>
                <div className="font-display font-bold text-white text-sm">DTC Region V · Staff Portal</div>
                <div className="text-blue-200 text-xs">Digital Transformation Center — Administration</div>
              </div>
            </div>
            <GovHeaderLogos/>
          </div>
          <div className="border-t border-white/15 flex items-center justify-between py-1">
            <nav className="flex gap-0.5 flex-wrap">
              {(['dashboard','logs','pcs','network','security','auditlog','announcements','analytics','admins','settings'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-all ${tab===t ? 'bg-white text-[var(--dict-blue)] shadow-sm' : 'text-blue-200 hover:text-white hover:bg-white/10'}`}>
                  {t==='pcs'?'🖥 Stations':t==='network'?'📡 Network':t==='dashboard'?'📊 Dashboard':t==='settings'?'⚙️ Settings':t==='security'?'🔒 Security':t==='auditlog'?'📜 Audit':t==='announcements'?'📢 Notices':t==='analytics'?'📈 Analytics':t==='admins'?'👥 Admins':'📋 Logs'}
                </button>
              ))}
            </nav>
            <button onClick={handleLogout} className="text-xs text-blue-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">Sign Out →</button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ══════════════════════════════════════════════════════════ DASHBOARD */}
        {tab === 'dashboard' && s && (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Today's Clients", value: todayLogs.length, icon: '👥', view: 'today' as DashView, bg: 'bg-[var(--dict-blue)] text-white', active: dashView === 'today' },
                { label: 'Currently Active', value: activeLogs.length, icon: '🟢', view: 'active' as DashView, bg: 'bg-emerald-600 text-white', active: dashView === 'active' },
                { label: 'Total Entries', value: s.total as number, icon: '📋', view: null, nav: 'logs' },
                { label: 'PCs Online', value: (s.pcs as Record<string,number>)?.online || 0, icon: '🖥️', view: null, nav: 'pcs' },
              ].map(c => (
                <button key={c.label} onClick={() => {
                  if (c.view) setDashView(c.view)
                  else if (c.nav) setTab(c.nav as 'logs' | 'pcs')
                }}
                  className={`${c.bg || 'bg-white'} rounded-2xl p-5 shadow-sm text-left hover:scale-[1.02] hover:shadow-md transition-all active:scale-[0.98] ${c.active ? 'ring-2 ring-offset-2 ring-[var(--dict-gold)]' : ''}`}>
                  <div className="text-2xl mb-2">{c.icon}</div>
                  <div className="text-3xl font-display font-bold">{c.value}</div>
                  <div className={`text-sm mt-1 ${c.bg?.includes('text-white') ? 'text-white/70' : 'text-gray-500'}`}>{c.label}</div>
                  {c.view && <div className={`text-xs mt-1 ${c.active ? 'opacity-100' : 'opacity-60'}`}>{c.active ? '▼ Showing below' : 'Click to view'}</div>}
                </button>
              ))}
            </div>

            {/* View toggle + entry list + PC summary */}
            <div className="grid lg:grid-cols-3 gap-5">
              {/* Entries panel */}
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <h3 className="font-display font-semibold text-gray-800">
                      {dashView === 'today' ? "Today's Clients" : dashView === 'active' ? 'Currently Active' : 'Recent Entries'}
                    </h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{dashLogs.length}</span>
                  </div>
                  <div className="flex gap-1">
                    {(['recent', 'today', 'active'] as DashView[]).map(v => (
                      <button key={v} onClick={() => setDashView(v)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${dashView === v ? 'bg-[var(--dict-blue)] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                        {v === 'recent' ? 'Recent' : v === 'today' ? 'Today' : 'Active'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-4 space-y-3 max-h-[520px] overflow-y-auto">
                  {dashLogs.length === 0
                    ? <p className="text-center text-gray-300 py-12">No entries for this view</p>
                    : dashLogs.map(log => (
                      <LogCard key={log.id} log={log} compact onEdit={setEditLog} onCheckout={handleCheckout}/>
                    ))
                  }
                </div>
              </div>

              {/* PC status + usage charts */}
              <div className="space-y-4">
                {/* PC status */}
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <h3 className="font-display font-semibold text-gray-800 mb-3">Workstation Status</h3>
                  <div className="space-y-2">
                    {(['ONLINE', 'IN_USE', 'OFFLINE', 'MAINTENANCE'] as PCStatus[]).map(st => {
                      const count = pcs.filter(p => p.status === st).length
                      const m = STATUS_META[st]
                      return (
                        <div key={st} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${m.dot}`}/>
                            <span className="text-sm text-gray-600">{m.label}</span>
                          </div>
                          <span className="font-bold text-gray-800">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                  <button onClick={() => setTab('pcs')} className="mt-3 w-full text-xs text-center text-[var(--dict-blue)] hover:underline">View all stations →</button>
                </div>

                {/* Equipment usage chart */}
                {equipmentFreq.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm p-5">
                    <BarChart data={equipmentFreq} title="Equipment Usage" color="bg-[var(--dict-blue)]"/>
                  </div>
                )}
              </div>
            </div>

            {/* Report charts row */}
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <BarChart data={purposeFreq} title="Purpose / Service Frequency" color="bg-emerald-500"/>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <BarChart data={agencyFreq} title="Agency / Organization Frequency" color="bg-purple-500"/>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ LOGS */}
        {tab === 'logs' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or agency..."
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm flex-1 min-w-48 outline-none focus:border-[var(--dict-blue)]"/>
                <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
                <button onClick={fetchLogs} className="px-5 py-2.5 bg-[var(--dict-blue)] text-white rounded-xl text-sm font-medium">Search</button>
                <button onClick={() => { const p = dateFilter ? `?date=${dateFilter}` : ''; window.open(`/api/logs/export${p}`, '_blank') }}
                  className="px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-green-700">
                  ↓ Export CSV
                </button>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                <p className="text-xs text-gray-400">{allLogs.length} entries{dateFilter ? ` on ${dateFilter}` : ''}</p>
                <div className="flex gap-2">
                  <span className="text-xs text-gray-400">Active: <strong className="text-green-600">{activeLogs.length}</strong></span>
                  <span className="text-xs text-gray-400">Today: <strong className="text-blue-600">{todayLogs.length}</strong></span>
                </div>
              </div>
            </div>

            {/* Log cards grid */}
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {allLogs.map(log => (
                <LogCard key={log.id} log={log} onEdit={setEditLog} onCheckout={handleCheckout}/>
              ))}
              {allLogs.length === 0 && (
                <div className="col-span-3 text-center py-20 text-gray-300">
                  <div className="text-5xl mb-4">📋</div>
                  <p>No entries found. Try adjusting your search or date filter.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ STATIONS */}
        {tab === 'pcs' && (
          <div className="space-y-5">
            {/* Add PC */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-display font-semibold text-gray-700 mb-3">Add Workstation</h3>
              <div className="flex flex-wrap gap-3">
                <input value={newPc.name} onChange={e=>setNewPc(f=>({...f,name:e.target.value}))} placeholder="Name (PC-09)"
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm flex-1 min-w-24 outline-none focus:border-[var(--dict-blue)]"/>
                <input value={newPc.ipAddress} onChange={e=>setNewPc(f=>({...f,ipAddress:e.target.value}))} placeholder="192.168.1.109"
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono flex-1 min-w-40 outline-none focus:border-[var(--dict-blue)]"/>
                <input value={newPc.location} onChange={e=>setNewPc(f=>({...f,location:e.target.value}))} placeholder="Location / Area"
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm flex-1 min-w-28 outline-none focus:border-[var(--dict-blue)]"/>
                <button onClick={addPc} className="px-5 py-2.5 bg-[var(--dict-blue)] text-white rounded-xl text-sm font-medium whitespace-nowrap">+ Add</button>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm text-gray-500 font-medium">{pcs.length} workstations</p>
                {(['ONLINE','IN_USE','OFFLINE','MAINTENANCE'] as PCStatus[]).map(st=>(
                  <span key={st} className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${STATUS_META[st].badge}`}>
                    {pcs.filter(p=>p.status===st).length} {STATUS_META[st].label}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={()=>setShowGridSettings(v=>!v)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all shadow-sm ${showGridSettings?'bg-[var(--dict-blue)] text-white border-[var(--dict-blue)]':'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                  ⚙️ Grid Settings
                </button>
                <button onClick={pingAll} disabled={pingAllLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm text-gray-600 hover:border-blue-300 disabled:opacity-50 shadow-sm transition-colors">
                  {pingAllLoading?<><Spinner/> Pinging...</>:<>📡 Ping All</>}
                </button>
              </div>
            </div>

            {/* Grid Settings Panel */}
            {showGridSettings && (
              <div className="bg-blue-50 border-2 border-[var(--dict-blue)] rounded-2xl p-5">
                <h3 className="font-display font-semibold text-[var(--dict-blue)] mb-1">Floor Plan Grid Settings</h3>
                <p className="text-xs text-blue-500 mb-4">Set how many columns and rows your floor map has. Empty cells act as spacing — useful for hallways, walls, or gaps between station groups. Each PC&apos;s position is set in its Edit panel.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Columns</label>
                    <div className="flex items-center gap-2">
                      <button onClick={()=>setGridCols(c=>Math.max(1,c-1))} className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 font-bold">−</button>
                      <span className="font-display font-bold text-xl text-gray-800 w-8 text-center">{gridCols}</span>
                      <button onClick={()=>setGridCols(c=>Math.min(12,c+1))} className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 font-bold">+</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Rows</label>
                    <div className="flex items-center gap-2">
                      <button onClick={()=>setGridRowCount(r=>Math.max(1,r-1))} className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 font-bold">−</button>
                      <span className="font-display font-bold text-xl text-gray-800 w-8 text-center">{gridRowCount}</span>
                      <button onClick={()=>setGridRowCount(r=>Math.min(12,r+1))} className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 font-bold">+</button>
                    </div>
                  </div>
                  <div className="col-span-2 flex items-end">
                    <div className="bg-white rounded-xl px-4 py-2 border border-blue-200 text-xs text-blue-600">
                      Grid: <strong>{gridCols} × {gridRowCount}</strong> = {gridCols * gridRowCount} cells total · {pcs.length} stations placed
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Floor Plan Grid */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display font-semibold text-gray-700">Floor Plan</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Each cell = one grid position · Empty cells = open space · Click ✏️ to reposition a station</p>
                </div>
                <div className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-100">
                  {gridCols} col × {gridRowCount} row
                </div>
              </div>

              {/* Legend */}
              <div className="flex gap-3 flex-wrap mb-4 text-xs">
                {[
                  {color:'bg-green-100 border-green-300',label:'Available'},
                  {color:'bg-orange-100 border-orange-300',label:'In Use'},
                  {color:'bg-gray-100 border-gray-300',label:'Offline'},
                  {color:'bg-yellow-100 border-yellow-300',label:'Maintenance'},
                  {color:'bg-white border-dashed border-gray-200',label:'Empty space'},
                ].map(l=>(
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className={`w-4 h-4 rounded border-2 ${l.color}`}/>
                    <span className="text-gray-500">{l.label}</span>
                  </div>
                ))}
              </div>

              {/* The grid — render ALL cells row×col */}
              <div
                className="border border-gray-100 rounded-xl overflow-hidden"
                style={{ display:'grid', gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`, gap:'4px', padding:'8px', background:'#f9fafb' }}>
                {Array.from({length: gridRowCount}, (_, row) =>
                  Array.from({length: gridCols}, (_, col) => {
                    const r = row + 1, c = col + 1
                    const pc = pcs.find(p => (p.gridRow??1) === r && (p.gridCol??1) === c)
                    const currentUser = pc?.logs?.[0]
                    if (pc) {
                      const sm = STATUS_META[pc.status]
                      return (
                        <div key={`${r}-${c}`}
                          draggable
                          onDragStart={()=>setDraggingId(pc.id)}
                          onDragOver={e=>{e.preventDefault();setDragOverId(`${r}-${c}`)}}
                          onDrop={()=>handleDrop(pc.id)}
                          onDragEnd={()=>{setDraggingId(null);setDragOverId(null)}}
                          className={`rounded-xl border-2 p-2.5 transition-all cursor-grab active:cursor-grabbing select-none ${
                            dragOverId===`${r}-${c}`?'border-[var(--dict-blue)] bg-blue-50 scale-105':
                            draggingId===pc.id?'opacity-40':
                            pc.status==='IN_USE'?'border-orange-300 bg-orange-50':
                            pc.status==='ONLINE'?'border-green-300 bg-green-50':
                            pc.status==='MAINTENANCE'?'border-yellow-300 bg-yellow-50':
                            'border-gray-200 bg-gray-50'
                          }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-base leading-none">{pc.icon||'🖥️'}</span>
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sm.dot} ${pc.status==='ONLINE'?'animate-pulse':''}`}/>
                          </div>
                          <p className="font-bold text-gray-800 text-xs leading-tight truncate">{pc.name}</p>
                          <p className="font-mono text-gray-400 text-[10px] truncate">{pc.ipAddress}</p>
                          {pc.location && <p className="text-gray-400 text-[10px] truncate">{pc.location}</p>}
                          <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${sm.badge}`}>
                            {sm.label}
                          </span>
                          {pc.status==='IN_USE' && currentUser && (
                            <div className="mt-1.5 pt-1.5 border-t border-orange-200 flex items-center gap-1">
                              <Avatar name={currentUser.fullName} photo={currentUser.photoDataUrl} size="sm"/>
                              <p className="text-[10px] font-semibold text-orange-700 truncate">{currentUser.fullName.split(' ')[0]}</p>
                            </div>
                          )}
                          {pc.specs && <p className="text-[10px] text-gray-400 mt-1 line-clamp-1 italic">{pc.specs}</p>}
                          <div className="flex gap-1 mt-2">
                            <button onClick={e=>{e.stopPropagation();pingPc(pc)}} disabled={pingingId===pc.id}
                              className="flex-1 text-[10px] py-1 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors disabled:opacity-40">
                              {pingingId===pc.id?'…':'📡'}
                            </button>
                            <button onClick={e=>{e.stopPropagation();setEditingPc(pc)}}
                              className="flex-1 text-[10px] py-1 rounded-lg border border-gray-200 text-gray-400 hover:text-yellow-600 hover:border-yellow-300 transition-colors">
                              ✏️
                            </button>
                            <button onClick={e=>{e.stopPropagation();deletePc(pc.id)}}
                              className="text-[10px] py-1 px-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors">
                              🗑
                            </button>
                          </div>
                          <div className="mt-1 text-center">
                            <span className="text-[9px] text-gray-300">R{r}·C{c}</span>
                          </div>
                        </div>
                      )
                    }
                    // Empty cell — drop target
                    return (
                      <div key={`${r}-${c}`}
                        onDragOver={e=>{e.preventDefault();setDragOverId(`${r}-${c}`)}}
                        onDrop={async ()=>{
                          if (draggingId) {
                            await fetch(`/api/pcs/${draggingId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({gridRow:r,gridCol:c})})
                            setDraggingId(null);setDragOverId(null);fetchPcs()
                          }
                        }}
                        onDragEnd={()=>{setDraggingId(null);setDragOverId(null)}}
                        className={`rounded-xl border-2 border-dashed min-h-[80px] flex items-center justify-center transition-all ${
                          dragOverId===`${r}-${c}`?'border-[var(--dict-blue)] bg-blue-50':'border-gray-200 bg-white'
                        }`}>
                        {dragOverId===`${r}-${c}`
                          ? <p className="text-[10px] text-blue-400 font-semibold">Drop here</p>
                          : <p className="text-[10px] text-gray-200">R{r}·C{c}</p>
                        }
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Unplaced / out-of-bounds PCs list */}
            {pcs.some(p => (p.gridRow??1) > gridRowCount || (p.gridCol??1) > gridCols) && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-sm font-semibold text-amber-800 mb-2">⚠ Stations outside current grid</p>
                <div className="flex flex-wrap gap-2">
                  {pcs.filter(p=>(p.gridRow??1)>gridRowCount||(p.gridCol??1)>gridCols).map(pc=>(
                    <div key={pc.id} className="flex items-center gap-2 bg-white border border-amber-200 rounded-xl px-3 py-2">
                      <span>{pc.icon||'🖥️'}</span>
                      <span className="text-sm font-semibold text-gray-700">{pc.name}</span>
                      <span className="text-xs text-gray-400">R{pc.gridRow}·C{pc.gridCol}</span>
                      <button onClick={()=>setEditingPc(pc)} className="text-xs text-blue-500 underline">Reposition</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ NETWORK */}
        {tab === 'network' && (
          <div className="grid lg:grid-cols-2 gap-5">
            {/* LEFT COL */}
            <div className="space-y-5">
              {/* Ping single IP */}
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <h3 className="font-display font-semibold text-gray-700 mb-1 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-blue-100 text-[var(--dict-blue)] flex items-center justify-center text-sm">🔍</span>
                  Ping IP Address
                </h3>
                <p className="text-xs text-gray-400 mb-4">Check if a device is online and measure response time.</p>
                <div className="flex gap-2">
                  <input value={ipSearch} onChange={e=>setIpSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&searchIp()}
                    placeholder="e.g. 192.168.1.117"
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 font-mono text-sm outline-none focus:border-[var(--dict-blue)]"/>
                  <button onClick={searchIp} disabled={ipLoading}
                    className="px-5 py-2.5 bg-[var(--dict-blue)] text-white rounded-xl text-sm font-bold disabled:opacity-60">
                    {ipLoading?'…':'Ping'}
                  </button>
                </div>
                {ipResult && (
                  <div className={`mt-3 rounded-xl p-4 flex items-center gap-4 border ${ipResult.alive?'bg-green-50 border-green-200':'bg-red-50 border-red-200'}`}>
                    <div className={`w-4 h-4 rounded-full flex-shrink-0 ${ipResult.alive?'bg-green-500 animate-pulse':'bg-red-400'}`}/>
                    <div>
                      <p className={`font-bold text-sm ${ipResult.alive?'text-green-700':'text-red-600'}`}>
                        {ipResult.ip} is {ipResult.alive?'ONLINE ✓':'OFFLINE ✗'}
                      </p>
                      {ipResult.alive&&ipResult.responseTime&&<p className="text-xs text-green-500">{ipResult.responseTime}ms response time</p>}
                      {ipResult.pcName&&<p className="text-xs text-gray-500 mt-0.5">Registered as: <strong>{ipResult.pcName}</strong></p>}
                    </div>
                    {ipResult.alive&&!ipResult.pcName&&(
                      <button onClick={async()=>{
                        const name = prompt('Register this IP as a workstation? Enter name:')
                        if (!name) return
                        await fetch('/api/pcs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,ipAddress:ipResult?.ip,location:''})})
                        fetchPcs()
                      }} className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-[var(--dict-blue)] text-white font-semibold">
                        + Register
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Subnet scanner */}
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <h3 className="font-display font-semibold text-gray-700 mb-1 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-sm">🌐</span>
                  Subnet Scanner
                </h3>
                <p className="text-xs text-gray-400 mb-4">Scan a range of IPs to find all live devices on the network.</p>
                <div className="flex flex-wrap gap-3 mb-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Base IP</label>
                    <input value={scanConfig.baseIp} onChange={e=>setScanConfig(f=>({...f,baseIp:e.target.value}))}
                      className="w-36 border border-gray-200 rounded-xl px-3 py-2 font-mono text-sm outline-none focus:border-[var(--dict-blue)]"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">From</label>
                    <input value={scanConfig.start} onChange={e=>setScanConfig(f=>({...f,start:e.target.value}))}
                      className="w-16 border border-gray-200 rounded-xl px-3 py-2 font-mono text-sm outline-none focus:border-[var(--dict-blue)]"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">To</label>
                    <input value={scanConfig.end} onChange={e=>setScanConfig(f=>({...f,end:e.target.value}))}
                      className="w-16 border border-gray-200 rounded-xl px-3 py-2 font-mono text-sm outline-none focus:border-[var(--dict-blue)]"/>
                  </div>
                  <div className="flex items-end">
                    <button onClick={handleScan} disabled={scanning}
                      className="px-5 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold disabled:opacity-60 hover:bg-purple-700 flex items-center gap-2">
                      {scanning&&<Spinner/>}{scanning?`Scanning ${scanConfig.baseIp}.${scanConfig.start}–${scanConfig.end}…`:'🔍 Scan'}
                    </button>
                  </div>
                </div>
                {scanResults.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-600">{scanResults.length} live devices found</p>
                      <p className="text-xs text-gray-400">{scanResults.filter(h=>pcs.find(p=>p.ipAddress===h.ip)).length} registered · {scanResults.filter(h=>!pcs.find(p=>p.ipAddress===h.ip)).length} unregistered</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {scanResults.map(h=>{
                        const reg = pcs.find(p=>p.ipAddress===h.ip)
                        return (
                          <div key={h.ip} className={`rounded-xl p-2.5 border ${reg?'bg-blue-50 border-blue-200':'bg-green-50 border-green-200'}`}>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"/>
                              <span className="font-mono text-xs font-bold text-gray-800">{h.ip}</span>
                            </div>
                            <p className="text-xs text-gray-400">{h.responseTime}ms</p>
                            {reg
                              ? <p className="text-xs text-[var(--dict-blue)] font-semibold mt-0.5">📌 {reg.name}</p>
                              : <button onClick={async()=>{
                                  const name = prompt(`Register ${h.ip} as a workstation? Enter name:`)
                                  if (!name) return
                                  await fetch('/api/pcs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,ipAddress:h.ip,location:''})})
                                  fetchPcs()
                                }} className="text-xs text-green-600 font-semibold underline mt-0.5 block">+ Register</button>
                            }
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COL */}
            <div className="space-y-5">
              {/* Live station status */}
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-gray-700 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-green-100 text-green-600 flex items-center justify-center text-sm">📡</span>
                    Live Station Status
                  </h3>
                  <button onClick={pingAll} disabled={pingAllLoading}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center gap-1.5">
                    {pingAllLoading?<><Spinner/> Pinging...</>:'🔄 Refresh All'}
                  </button>
                </div>
                <div className="space-y-2">
                  {pcs.length===0
                    ? <p className="text-center text-gray-300 py-6 text-sm">No stations registered yet</p>
                    : pcs.map(pc=>{
                      const sm = STATUS_META[pc.status]
                      return (
                        <div key={pc.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${sm.dot} ${pc.status==='ONLINE'?'animate-pulse':''}`}/>
                          <span className="text-base">{pc.icon||'🖥️'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm text-gray-800">{pc.name}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full border ${sm.badge}`}>{sm.label}</span>
                            </div>
                            <p className="font-mono text-xs text-gray-400">{pc.ipAddress}{pc.location&&` · ${pc.location}`}</p>
                          </div>
                          {pc.lastSeen && <p className="text-xs text-gray-300 hidden sm:block">{formatDistanceToNow(new Date(pc.lastSeen),{addSuffix:true})}</p>}
                          <button onClick={()=>pingPc(pc)} disabled={pingingId===pc.id}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors disabled:opacity-40 flex-shrink-0">
                            {pingingId===pc.id?'…':'📡'}
                          </button>
                        </div>
                      )
                    })
                  }
                </div>
              </div>

              {/* Browser info note */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-sm font-semibold text-amber-800 mb-1 flex items-center gap-2">⚠️ Browser Security Note</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Browsers cannot read the WiFi SSID, MAC address, or do raw TCP port scans due to security restrictions.
                  The ping function uses the server-side API. For deeper network monitoring, use dedicated tools like
                  <strong> Advanced IP Scanner</strong> or <strong>Angry IP Scanner</strong> on the local machine.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ SECURITY */}
        {tab === 'security' && (
          <div className="space-y-5">
            {/* Header */}
            <div className="bg-[var(--dict-blue)] text-white rounded-2xl p-5">
              <h2 className="font-display font-bold text-xl">Security & IP Camera Monitor</h2>
              <p className="text-blue-200 text-sm mt-0.5">Connect and monitor IP cameras for the DTC premises. Supports MJPEG streams, HLS, and snapshot URLs.</p>
            </div>

            {/* Add camera form */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-display font-semibold text-gray-700 mb-4">Add IP Camera</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Camera Name</label>
                  <input value={newCamera.name} onChange={e=>setNewCamera(f=>({...f,name:e.target.value}))}
                    placeholder="e.g. Front Entrance, Server Room"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Stream Type</label>
                  <select value={newCamera.type} onChange={e=>setNewCamera(f=>({...f,type:e.target.value as typeof newCamera.type}))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]">
                    <option value="mjpeg">MJPEG Stream (most IP cams)</option>
                    <option value="snapshot">JPEG Snapshot (auto-refresh)</option>
                    <option value="hls">HLS Stream (m3u8)</option>
                    <option value="rtsp-proxy">RTSP via Proxy URL</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Stream / Snapshot URL</label>
                  <input value={newCamera.url} onChange={e=>setNewCamera(f=>({...f,url:e.target.value}))}
                    placeholder="http://192.168.1.200/video.cgi  or  http://192.168.1.200/snapshot.jpg"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-[var(--dict-blue)]"/>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Notes (optional)</label>
                  <input value={newCamera.notes} onChange={e=>setNewCamera(f=>({...f,notes:e.target.value}))}
                    placeholder="Location, orientation, brand/model..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
                </div>
              </div>

              {/* URL format guide */}
              <div className="mt-4 bg-blue-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-700 mb-2">Common URL Formats:</p>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {[
                    {label:'Generic MJPEG',url:'http://[IP]/video.cgi'},
                    {label:'Hikvision MJPEG',url:'http://[IP]/Streaming/Channels/1/httppreview'},
                    {label:'Dahua Snapshot',url:'http://[IP]/cgi-bin/snapshot.cgi'},
                    {label:'Tapo (requires proxy)',url:'rtsp://[user]:[pass]@[IP]:554/stream1'},
                    {label:'Generic Snapshot',url:'http://[IP]/snapshot.jpg'},
                    {label:'HLS stream',url:'http://[IP]/live/stream.m3u8'},
                  ].map(u=>(
                    <div key={u.label} className="flex items-center gap-2">
                      <span className="text-blue-400 text-xs font-semibold w-32 flex-shrink-0">{u.label}</span>
                      <code className="text-blue-600 text-xs font-mono">{u.url}</code>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={addCamera}
                className="mt-4 px-6 py-2.5 bg-[var(--dict-blue)] text-white rounded-xl font-semibold text-sm hover:bg-blue-800 disabled:opacity-50"
                disabled={!newCamera.name||!newCamera.url}>
                + Add Camera
              </button>
            </div>

            {/* Camera grid */}
            {cameras.length === 0
              ? (
                <div className="bg-white rounded-2xl p-12 shadow-sm text-center">
                  <div className="text-6xl mb-4">📷</div>
                  <p className="text-gray-400 font-semibold">No cameras added yet</p>
                  <p className="text-sm text-gray-300 mt-1">Add an IP camera above to start monitoring</p>
                </div>
              )
              : (
                <div>
                  {/* Refresh button */}
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-500">{cameras.filter(c=>c.enabled).length} of {cameras.length} cameras active</p>
                    <button onClick={()=>setCameraRefreshKey(k=>k+1)}
                      className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-blue-300 shadow-sm">
                      🔄 Refresh Snapshots
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {cameras.map(cam=>(
                      <div key={cam.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden border-2 transition-all ${cam.enabled?'border-gray-100':'border-gray-200 opacity-60'}`}>
                        {/* Camera feed */}
                        <div className="bg-gray-900 relative" style={{aspectRatio:'16/9'}}>
                          {cam.enabled
                            ? cam.type==='mjpeg'
                              ? <img key={cameraRefreshKey}
                                  src={cam.url} alt={cam.name}
                                  className="w-full h-full object-cover"
                                  onError={e=>{(e.target as HTMLImageElement).src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect fill="%23111"/><text x="50%" y="50%" fill="%23666" text-anchor="middle" font-size="14" dy=".3em">Stream unavailable</text></svg>'}}
                                />
                              : cam.type==='snapshot'
                              ? <img key={`${cameraRefreshKey}-${cam.id}`}
                                  src={`${cam.url}?t=${cameraRefreshKey}`} alt={cam.name}
                                  className="w-full h-full object-cover"
                                  onError={e=>{(e.target as HTMLImageElement).src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect fill="%23111"/><text x="50%" y="50%" fill="%23666" text-anchor="middle" font-size="14" dy=".3em">Snapshot unavailable</text></svg>'}}
                                />
                              : cam.type==='hls'
                              ? <div className="w-full h-full flex flex-col items-center justify-center">
                                  <div className="text-4xl mb-2">📺</div>
                                  <p className="text-gray-400 text-xs">HLS stream</p>
                                  <a href={cam.url} target="_blank" rel="noreferrer" className="mt-2 text-xs text-blue-400 underline">Open in player</a>
                                </div>
                              : <div className="w-full h-full flex flex-col items-center justify-center">
                                  <div className="text-4xl mb-2">📡</div>
                                  <p className="text-gray-400 text-xs text-center px-4">RTSP proxy stream<br/><span className="font-mono text-[10px] break-all">{cam.url}</span></p>
                                </div>
                            : (
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="text-center">
                                  <div className="text-4xl mb-2 opacity-30">📷</div>
                                  <p className="text-gray-600 text-sm">Camera disabled</p>
                                </div>
                              </div>
                            )
                          }
                          {/* Overlay: name + status dot */}
                          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cam.enabled?'bg-red-500 animate-pulse':'bg-gray-500'}`}/>
                            <span className="text-white text-xs font-semibold">{cam.name}</span>
                          </div>
                          {/* Fullscreen button */}
                          <button onClick={()=>setExpandedCam(expandedCam===cam.id?null:cam.id)}
                            className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors text-sm">
                            {expandedCam===cam.id?'⊠':'⊞'}
                          </button>
                        </div>

                        {/* Expanded view */}
                        {expandedCam===cam.id && cam.enabled && cam.type!=='hls' && cam.type!=='rtsp-proxy' && (
                          <div className="bg-gray-900 border-t border-gray-800" style={{aspectRatio:'16/9'}}>
                            <img key={`expanded-${cameraRefreshKey}`}
                              src={cam.type==='snapshot'?`${cam.url}?t=${cameraRefreshKey}-exp`:cam.url}
                              alt={cam.name} className="w-full h-full object-contain"/>
                          </div>
                        )}

                        {/* Info panel */}
                        <div className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">{cam.name}</p>
                              {cam.notes && <p className="text-xs text-gray-400">{cam.notes}</p>}
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                              cam.type==='mjpeg'?'bg-blue-50 text-blue-600 border-blue-200':
                              cam.type==='snapshot'?'bg-green-50 text-green-600 border-green-200':
                              cam.type==='hls'?'bg-purple-50 text-purple-600 border-purple-200':
                              'bg-amber-50 text-amber-600 border-amber-200'
                            }`}>{cam.type.toUpperCase()}</span>
                          </div>
                          <p className="font-mono text-[10px] text-gray-300 truncate">{cam.url}</p>
                          <div className="flex gap-2 pt-1">
                            <button onClick={()=>toggleCamera(cam.id)}
                              className={`flex-1 text-xs py-1.5 rounded-lg border font-semibold transition-colors ${
                                cam.enabled?'border-orange-200 text-orange-600 hover:bg-orange-50':'border-green-200 text-green-600 hover:bg-green-50'
                              }`}>
                              {cam.enabled?'⏸ Disable':'▶ Enable'}
                            </button>
                            <a href={cam.url} target="_blank" rel="noreferrer"
                              className="text-xs py-1.5 px-3 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                              ↗ Open
                            </a>
                            <button onClick={()=>removeCamera(cam.id)}
                              className="text-xs py-1.5 px-2 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition-colors">
                              🗑
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }

            {/* RTSP note */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">📋 About IP Camera Compatibility</p>
              <p className="text-xs text-amber-700 leading-relaxed mb-2">
                Browsers can only display <strong>MJPEG</strong> and <strong>JPEG snapshot</strong> streams directly.
                <strong> RTSP streams</strong> (used by Hikvision, Dahua, Tapo, etc.) require a proxy or transcoder like
                <strong> go2rtc</strong>, <strong>Frigate</strong>, or <strong>MediaMTX</strong> to convert to HLS/MJPEG for browser display.
              </p>
              <div className="flex flex-wrap gap-2">
                {['go2rtc (lightweight proxy)','Frigate (NVR + AI detection)','MediaMTX (RTSP→HLS)','Tapo Care (cloud)','Reolink app'].map(t=>(
                  <span key={t} className="text-xs bg-white border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full">{t}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ SETTINGS */}
        {tab === 'settings' && (
          <div className="grid lg:grid-cols-2 gap-5">
            {/* LEFT col */}
            <div className="space-y-5">
              {settingsSaved && (
                <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 flex items-center gap-2 text-green-700 text-sm font-semibold">
                  ✅ Settings saved! Front page reloads fresh settings immediately.
                </div>
              )}

              {/* Access code */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-8 h-8 rounded-lg bg-blue-100 text-[var(--dict-blue)] flex items-center justify-center">🔐</span>
                  <h3 className="font-display font-semibold text-gray-700">Daily Access Code</h3>
                </div>
                <p className="text-xs text-gray-400 mb-4">Change this daily. Clients must enter this before using the logbook. The hidden dot on the front page leads here.</p>
                <div className="flex gap-3 items-stretch">
                  <input type="text" value={settings.accessCode}
                    onChange={e=>setSettings(s=>({...s,accessCode:e.target.value}))}
                    maxLength={10}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-3xl font-mono tracking-widest text-center outline-none focus:border-[var(--dict-blue)]"/>
                  <div className="flex flex-col gap-2">
                    <button onClick={()=>setSettings(s=>({...s,accessCode:Math.floor(1000+Math.random()*9000).toString()}))}
                      className="px-4 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-500 hover:bg-gray-50 font-medium">🎲 Random 4-digit</button>
                    <button onClick={()=>setSettings(s=>({...s,accessCode:Math.floor(100000+Math.random()*900000).toString()}))}
                      className="px-4 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-500 hover:bg-gray-50 font-medium">🎲 Random 6-digit</button>
                  </div>
                </div>
                <p className="text-xs text-gray-300 mt-2 text-center">Current code: <strong className="font-mono text-gray-400">{settings.accessCode}</strong></p>
              </div>

              {/* Office hours */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">⏰</span>
                  <h3 className="font-display font-semibold text-gray-700">Office Hours</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  {[{label:'Opens at',key:'officeOpen',color:'text-green-600'},{label:'Closes at',key:'officeClose',color:'text-red-500'}].map(({label,key,color})=>(
                    <div key={key}>
                      <label className={`text-xs font-semibold ${color} block mb-1`}>{label}</label>
                      <input type="time" value={(settings as Record<string,string>)[key]}
                        onChange={e=>setSettings(s=>({...s,[key]:e.target.value}))}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-[var(--dict-blue)]"/>
                    </div>
                  ))}
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400">Logbook blocks access outside these hours and caps session duration automatically.</p>
                </div>
              </div>
            </div>

            {/* RIGHT col */}
            <div className="space-y-5">
              {/* WiFi */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">📶</span>
                  <h3 className="font-display font-semibold text-gray-700">WiFi Settings</h3>
                </div>
                <div className="space-y-3">
                  {[
                    {label:'Network Name (SSID)',key:'wifiSsid',ph:'DICT-DTC-Free',mono:true,type:'text'},
                    {label:'Password (blank = open)',key:'wifiPassword',ph:'Leave blank for open network',mono:true,type:'text'},
                    {label:'Description shown to clients',key:'wifiNote',ph:'Free public WiFi for DTC clients',mono:false,type:'text'},
                  ].map(f=>(
                    <div key={f.key}>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">{f.label}</label>
                      <input type={f.type} value={(settings as Record<string,string>)[f.key]} placeholder={f.ph}
                        onChange={e=>setSettings(s=>({...s,[f.key]:e.target.value}))}
                        className={`w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] ${f.mono?'font-mono':''}`}/>
                    </div>
                  ))}
                </div>
                {settings.wifiSsid && (
                  <div className="mt-4 bg-[var(--dict-blue)] rounded-2xl p-4 flex items-center gap-4">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(settings.wifiPassword?`WIFI:T:WPA;S:${settings.wifiSsid};P:${settings.wifiPassword};;`:`WIFI:T:nopass;S:${settings.wifiSsid};;;`)}`}
                      className="w-20 h-20 rounded-xl border-4 border-white/30" alt="WiFi QR"/>
                    <div className="text-white">
                      <p className="font-display font-bold text-base">{settings.wifiSsid}</p>
                      <p className="text-blue-200 text-sm">{settings.wifiPassword||'Open network'}</p>
                      <p className="text-blue-300 text-xs mt-1">{settings.wifiNote}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Logo instructions */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">🖼</span>
                  <h3 className="font-display font-semibold text-gray-700">Header Logos</h3>
                </div>
                <p className="text-xs text-gray-400 mb-3">Place these files in the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">/public</code> folder of the project. The header will automatically display them.</p>
                <div className="space-y-2">
                  {[
                    {file:'dict-seal.png',desc:'DICT official seal — shown left of title',status:true},
                    {file:'ilcdb-logo.png',desc:'ILCDB logo — shown top right',status:true},
                    {file:'bagong-pilipinas.png',desc:'Bagong Pilipinas seal — shown far right',status:false},
                  ].map(l=>(
                    <div key={l.file} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${l.status?'bg-green-400':'bg-gray-300'}`}/>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs font-bold text-gray-700">{l.file}</p>
                        <p className="text-xs text-gray-400">{l.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-300 mt-3">Place the real logos from DICT official assets. Falls back to text if not found.</p>
              </div>
            </div>

            {/* Save button — full width */}
            <div className="lg:col-span-2">
              <button onClick={saveSettings} className="w-full py-4 bg-[var(--dict-blue)] text-white font-bold rounded-2xl hover:bg-blue-800 shadow-lg shadow-blue-100 text-base flex items-center justify-center gap-2">
                💾 Save All Settings
              </button>
            </div>
          </div>
        )}
        {/* ══════════════════════════════════════════════════════════ AUDIT LOG */}
        {tab === 'auditlog' && (
          <AuditLogTab/>
        )}
        {tab === 'announcements' && (
          <AnnouncementsTab/>
        )}
        {tab === 'analytics' && (
          <AnalyticsTab/>
        )}
        {tab === 'admins' && (
          <AdminsTab currentAdminId={currentAdmin?.id ?? ''}/>
        )}
      </main>
    </div>
  )
}



// ── AnnouncementsTab ──────────────────────────────────────────────────────────
function AnnouncementsTab() {
  const [items, setItems] = useState<{id:string;title:string;body:string;type:string;active:boolean;expiresAt:string|null;createdBy:string|null;createdAt:string}[]>([])
  const [form, setForm] = useState({ title:'', body:'', type:'INFO', expiresAt:'' })
  const [saving, setSaving] = useState(false)
  const colors: Record<string,string> = {
    INFO:'bg-blue-100 text-blue-700 border-blue-200',
    WARNING:'bg-amber-100 text-amber-700 border-amber-200',
    MAINTENANCE:'bg-orange-100 text-orange-700 border-orange-200',
    HOLIDAY:'bg-red-100 text-red-700 border-red-200',
  }
  const icons: Record<string,string> = { INFO:'ℹ️', WARNING:'⚠️', MAINTENANCE:'🔧', HOLIDAY:'🎉' }

  const load = () => fetch('/api/announcements').then(r=>r.json()).then(setItems).catch(()=>{})
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.title || !form.body) return
    setSaving(true)
    await fetch('/api/announcements', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ...form, expiresAt: form.expiresAt || null }),
    })
    setForm({ title:'', body:'', type:'INFO', expiresAt:'' })
    load(); setSaving(false)
  }

  const toggle = async (id: string, active: boolean) => {
    await fetch(`/api/announcements/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ active: !active }) })
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this announcement?')) return
    await fetch(`/api/announcements/${id}`, { method:'DELETE' })
    load()
  }

  return (
    <div className="space-y-4">
      {/* Create form */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="font-display font-semibold text-gray-700 mb-4">Post Announcement</h3>
        <div className="space-y-3">
          <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
            placeholder="Title *" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
          <textarea value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))}
            placeholder="Message body *" rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] resize-none"/>
          <div className="grid grid-cols-2 gap-3">
            <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]">
              {['INFO','WARNING','MAINTENANCE','HOLIDAY'].map(t=>(
                <option key={t} value={t}>{icons[t]} {t}</option>
              ))}
            </select>
            <input type="datetime-local" value={form.expiresAt} onChange={e=>setForm(f=>({...f,expiresAt:e.target.value}))}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"
              title="Expires at (leave blank for permanent)"/>
          </div>
          <button onClick={save} disabled={saving || !form.title || !form.body}
            className="w-full py-2.5 rounded-xl bg-[var(--dict-blue)] text-white font-bold text-sm hover:bg-blue-800 disabled:opacity-50">
            {saving ? 'Posting...' : '📢 Post Announcement'}
          </button>
        </div>
      </div>

      {/* Active announcements */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="font-display font-semibold text-gray-700 mb-3">Active Notices ({items.filter(i=>i.active).length})</h3>
        {items.length === 0
          ? <p className="text-sm text-gray-400 text-center py-6">No announcements yet</p>
          : <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className={`border rounded-2xl p-4 flex items-start gap-3 ${colors[item.type] || colors.INFO} ${!item.active ? 'opacity-50' : ''}`}>
                <span className="text-xl flex-shrink-0">{icons[item.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{item.title}</p>
                  <p className="text-xs mt-0.5 opacity-80">{item.body}</p>
                  <div className="flex gap-2 mt-1 text-[10px] opacity-60">
                    <span>{item.type}</span>
                    {item.expiresAt && <span>· Expires {new Date(item.expiresAt).toLocaleDateString()}</span>}
                    {item.createdBy && <span>· By {item.createdBy}</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => toggle(item.id, item.active)}
                    className="text-xs px-2 py-1 rounded-lg border border-current opacity-70 hover:opacity-100">
                    {item.active ? 'Hide' : 'Show'}
                  </button>
                  <button onClick={() => remove(item.id)}
                    className="text-xs px-2 py-1 rounded-lg border border-current opacity-70 hover:opacity-100">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        }
      </div>
    </div>
  )
}

// ── AnalyticsTab ──────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const [range, setRange] = useState<'today'|'week'|'month'|'year'>('week')
  const [data, setData] = useState<Record<string,unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/stats?range=${range}`)
      .then(r=>r.json())
      .then(d=>{setData(d);setLoading(false)})
      .catch(()=>setLoading(false))
  }, [range])

  type StatItem = { count: number }
  const purposes = (data?.byPurpose as {purpose:string;count:number}[]) || []
  const equipment = (data?.byEquipment as {equipment:string;count:number}[]) || []
  const byHour = (data?.byHour as {hour:number;count:number}[]) || []
  const dailyTrend = (data?.dailyTrend as {day:string;count:number}[]) || []
  const summary = (data?.summary as Record<string,number|null>) || {}
  const ratingDist = (data?.ratingDist as {rating:number;count:number}[]) || []
  const serviceTypes = (data?.byServiceType as {type:string;count:number}[]) || []

  const maxHour = Math.max(1, ...byHour.map(h=>h.count))
  const maxDay  = Math.max(1, ...dailyTrend.map(d=>d.count))

  const rangeLabel = { today:'Today', week:'This Week', month:'This Month', year:'This Year' }

  return (
    <div className="space-y-4">
      {/* Range selector */}
      <div className="bg-white rounded-2xl p-4 shadow-sm flex gap-2 flex-wrap">
        {(['today','week','month','year'] as const).map(r => (
          <button key={r} onClick={() => setRange(r)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${range===r ? 'bg-[var(--dict-blue)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {rangeLabel[r]}
          </button>
        ))}
        <a href={`/api/logs/export?all=true`} target="_blank" rel="noreferrer"
          className="ml-auto px-4 py-2 rounded-xl text-sm font-semibold bg-green-100 text-green-700 hover:bg-green-200 flex items-center gap-1.5">
          ⬇ Export All CSV
        </a>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-300 shadow-sm">Loading analytics...</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label:'Total Clients', value: summary.total ?? 0, icon:'👥', color:'text-[var(--dict-blue)]' },
              { label:'Avg Duration', value: summary.avgDurationMins ? `${summary.avgDurationMins}m` : '—', icon:'⏱', color:'text-purple-600' },
              { label:'Avg Rating', value: summary.avgRating ? `${summary.avgRating}★` : '—', icon:'⭐', color:'text-yellow-600' },
              { label:'Ratings Given', value: summary.ratingCount ?? 0, icon:'📝', color:'text-green-600' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className={`text-2xl font-bold font-display ${s.color}`}>{String(s.value)}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Hourly heatmap */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-display font-semibold text-gray-700 text-sm mb-3">Peak Hours</h3>
              <div className="space-y-1">
                {Array.from({length:10}, (_,i)=>i+8).map(h => {
                  const entry = byHour.find(e=>e.hour===h)
                  const count = entry?.count ?? 0
                  const pct = Math.round((count / maxHour) * 100)
                  return (
                    <div key={h} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-14 flex-shrink-0 text-right">
                        {h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h-12}:00 PM`}
                      </span>
                      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-5 bg-[var(--dict-blue)] rounded-full transition-all"
                          style={{width:`${pct}%`, opacity: 0.3 + (pct/100)*0.7}}/>
                      </div>
                      <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Daily trend */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-display font-semibold text-gray-700 text-sm mb-3">Daily Trend</h3>
              {dailyTrend.length === 0
                ? <p className="text-xs text-gray-300 text-center py-8">No data</p>
                : <div className="flex items-end gap-1 h-32">
                  {dailyTrend.slice(-14).map(d => (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-gray-400">{d.count}</span>
                      <div className="w-full rounded-t bg-[var(--dict-blue)]"
                        style={{height:`${Math.max(4, (d.count/maxDay)*100)}px`, opacity:0.5+(d.count/maxDay)*0.5}}/>
                      <span className="text-[9px] text-gray-300 rotate-45 origin-left">{d.day.slice(5)}</span>
                    </div>
                  ))}
                </div>
              }
            </div>

            {/* Purpose breakdown */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-display font-semibold text-gray-700 text-sm mb-3">Top Purposes</h3>
              <div className="space-y-2">
                {purposes.slice(0,8).map((p,i) => {
                  const max = purposes[0]?.count || 1
                  return (
                    <div key={p.purpose}>
                      <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                        <span className="truncate max-w-[70%]">{p.purpose}</span>
                        <span className="font-semibold">{p.count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-2 bg-blue-400 rounded-full" style={{width:`${(p.count/max)*100}%`}}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Equipment + Service Type + Ratings */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <h3 className="font-display font-semibold text-gray-700 text-sm mb-3">Services Used</h3>
                <div className="space-y-1.5">
                  {equipment.slice(0,6).map(e => (
                    <div key={e.equipment} className="flex justify-between text-xs">
                      <span className="text-gray-600">{e.equipment}</span>
                      <span className="font-semibold text-[var(--dict-blue)]">{e.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {ratingDist.length > 0 && (
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <h3 className="font-display font-semibold text-gray-700 text-sm mb-3">Satisfaction Distribution</h3>
                  <div className="space-y-1.5">
                    {[5,4,3,2,1].map(star => {
                      const entry = ratingDist.find(r=>r.rating===star)
                      const count = entry?.count ?? 0
                      const total = ratingDist.reduce((a,r)=>a+r.count,0) || 1
                      return (
                        <div key={star} className="flex items-center gap-2">
                          <span className="text-xs w-12 flex-shrink-0">{'⭐'.repeat(star)}</span>
                          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-3 bg-yellow-400 rounded-full" style={{width:`${(count/total)*100}%`}}/>
                          </div>
                          <span className="text-xs text-gray-500 w-6">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {serviceTypes.length > 0 && (
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <h3 className="font-display font-semibold text-gray-700 text-sm mb-3">Service Type</h3>
                  <div className="space-y-1.5">
                    {serviceTypes.map(s => (
                      <div key={s.type} className="flex justify-between text-xs">
                        <span className="text-gray-600">{s.type === 'SELF_SERVICE' ? '🙋 Self-Service' : '👨‍💼 Staff-Assisted'}</span>
                        <span className="font-semibold text-[var(--dict-blue)]">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── AdminsTab ─────────────────────────────────────────────────────────────────
function AdminsTab({ currentAdminId }: { currentAdminId: string }) {
  const [admins, setAdmins] = useState<{id:string;username:string;name:string;role:string;lastLoginAt:string|null;createdAt:string}[]>([])
  const [newAdmin, setNewAdmin] = useState({ username:'', password:'', name:'', role:'STAFF' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [pwdChange, setPwdChange] = useState<{id:string;old:string;new:string;confirm:string} | null>(null)
  const [pwdError, setPwdError] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)

  const load = () => fetch('/api/admins').then(r=>r.json()).then(d=>Array.isArray(d)?setAdmins(d):[]).catch(()=>{})
  useEffect(() => { load() }, [])

  const create = async () => {
    setCreateError('')
    if (!newAdmin.username || !newAdmin.password || !newAdmin.name) {
      setCreateError('All fields required'); return
    }
    if (newAdmin.password.length < 8) {
      setCreateError('Password must be at least 8 characters'); return
    }
    setCreating(true)
    const r = await fetch('/api/admins', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newAdmin),
    })
    const d = await r.json()
    if (!r.ok) { setCreateError(d.error || 'Failed'); setCreating(false); return }
    setNewAdmin({ username:'', password:'', name:'', role:'STAFF' })
    load(); setCreating(false)
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this admin account?')) return
    await fetch(`/api/admins/${id}`, { method:'DELETE' })
    load()
  }

  const savePassword = async () => {
    if (!pwdChange) return
    setPwdError('')
    if (pwdChange.new !== pwdChange.confirm) { setPwdError('Passwords do not match'); return }
    if (pwdChange.new.length < 8) { setPwdError('Password must be 8+ characters'); return }
    setPwdSaving(true)
    const isSelf = pwdChange.id === currentAdminId
    const body: Record<string,string> = { newPassword: pwdChange.new }
    if (isSelf) body.oldPassword = pwdChange.old
    const r = await fetch(`/api/admins/${pwdChange.id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body),
    })
    const d = await r.json()
    if (!r.ok) { setPwdError(d.error || 'Failed'); setPwdSaving(false); return }
    setPwdChange(null); setPwdSaving(false)
  }

  const roleColors: Record<string,string> = {
    SUPER_ADMIN:'bg-red-100 text-red-700',
    ADMIN:'bg-blue-100 text-blue-700',
    STAFF:'bg-gray-100 text-gray-600',
  }

  return (
    <div className="space-y-4">
      {/* Existing admins */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="font-display font-semibold text-gray-700 mb-4">Admin Accounts ({admins.length})</h3>
        <div className="space-y-2">
          {admins.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
              <div className="w-9 h-9 rounded-full bg-[var(--dict-blue)] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                {a.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-800">{a.name}</p>
                  {a.id === currentAdminId && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">You</span>}
                </div>
                <p className="text-xs text-gray-400">@{a.username}</p>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-full font-bold flex-shrink-0 ${roleColors[a.role]||roleColors.STAFF}`}>
                {a.role.replace('_',' ')}
              </span>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => { setPwdChange({id:a.id,old:'',new:'',confirm:''}); setPwdError('') }}
                  className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-[var(--dict-blue)]">
                  🔑 Password
                </button>
                {a.id !== currentAdminId && (
                  <button onClick={() => remove(a.id)}
                    className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-red-400 hover:border-red-300 hover:text-red-500">
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Password change modal */}
      {pwdChange && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="font-display font-bold text-lg mb-4">Change Password</h3>
            {pwdChange.id === currentAdminId && (
              <input type="password" placeholder="Current password *"
                value={pwdChange.old}
                onChange={e => setPwdChange(p => p ? {...p, old: e.target.value} : p)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] mb-3"/>
            )}
            <input type="password" placeholder="New password (8+ chars) *"
              value={pwdChange.new}
              onChange={e => setPwdChange(p => p ? {...p, new: e.target.value} : p)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] mb-3"/>
            <input type="password" placeholder="Confirm new password *"
              value={pwdChange.confirm}
              onChange={e => setPwdChange(p => p ? {...p, confirm: e.target.value} : p)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] mb-3"/>
            {pwdError && <p className="text-xs text-red-500 mb-3">{pwdError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setPwdChange(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500">Cancel</button>
              <button onClick={savePassword} disabled={pwdSaving} className="flex-[2] py-2.5 rounded-xl bg-[var(--dict-blue)] text-white font-bold text-sm hover:bg-blue-800 disabled:opacity-60">
                {pwdSaving ? 'Saving...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create new admin */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="font-display font-semibold text-gray-700 mb-4">Create Admin Account</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <input value={newAdmin.name} onChange={e=>setNewAdmin(a=>({...a,name:e.target.value}))}
            placeholder="Full name *" className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
          <input value={newAdmin.username} onChange={e=>setNewAdmin(a=>({...a,username:e.target.value}))}
            placeholder="Username (a-z, 0-9, _) *" className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
          <input type="password" value={newAdmin.password} onChange={e=>setNewAdmin(a=>({...a,password:e.target.value}))}
            placeholder="Password (8+ chars) *" className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]"/>
          <select value={newAdmin.role} onChange={e=>setNewAdmin(a=>({...a,role:e.target.value}))}
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)]">
            <option value="STAFF">Staff</option>
            <option value="ADMIN">Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
        </div>
        {createError && <p className="text-xs text-red-500 mt-2">{createError}</p>}
        <button onClick={create} disabled={creating}
          className="mt-3 w-full py-2.5 rounded-xl bg-[var(--dict-blue)] text-white font-bold text-sm hover:bg-blue-800 disabled:opacity-50">
          {creating ? 'Creating...' : '+ Create Account'}
        </button>
        <p className="text-[10px] text-gray-400 mt-2 text-center">Only Super Admin can create accounts</p>
      </div>
    </div>
  )
}

// ── AuditLogTab ──────────────────────────────────────────────────────────────
function AuditLogTab() {
  const [logs, setLogs] = useState<{id:string;action:string;target:string|null;detail:string|null;ip:string|null;createdAt:string;admin?:{username:string;name:string}|null}[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin-logs?limit=200')
      .then(r => r.json())
      .then(d => { setLogs(d); setLoading(false) })
  }, [])

  const ACTION_COLORS: Record<string, string> = {
    LOGIN: 'bg-blue-100 text-blue-700',
    CREATE_LOG: 'bg-green-100 text-green-700',
    CHECKOUT: 'bg-teal-100 text-teal-700',
    AUTO_CHECKOUT: 'bg-amber-100 text-amber-700',
    EDIT_LOG: 'bg-yellow-100 text-yellow-700',
    ARCHIVE_LOG: 'bg-red-100 text-red-700',
    CHANGE_SETTING: 'bg-purple-100 text-purple-700',
    CREATE_PC: 'bg-indigo-100 text-indigo-700',
    EDIT_PC: 'bg-indigo-100 text-indigo-700',
    CREATE_CAMERA: 'bg-pink-100 text-pink-700',
    DELETE_CAMERA: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-semibold text-gray-700">Admin Activity Audit Trail</h3>
            <p className="text-xs text-gray-400 mt-0.5">All admin actions are logged here for Data Privacy Act compliance. Last 200 entries.</p>
          </div>
          <a href="/print" target="_blank" className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-blue-300">
            🖨 Print Log
          </a>
        </div>
        {loading
          ? <p className="text-center py-8 text-gray-300">Loading...</p>
          : logs.length === 0
          ? <p className="text-center py-8 text-gray-300">No activity yet</p>
          : (
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold flex-shrink-0 mt-0.5 ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                    {log.action.replace(/_/g,' ')}
                  </span>
                  <div className="flex-1 min-w-0">
                    {log.target && <p className="text-xs font-mono text-gray-500 truncate">ID: {log.target}</p>}
                    {log.detail && (() => {
                      try {
                        const d = JSON.parse(log.detail)
                        return <p className="text-xs text-gray-500">{Object.entries(d).map(([k,v])=>`${k}: ${v}`).join(' · ')}</p>
                      } catch {
                        return <p className="text-xs text-gray-500">{log.detail}</p>
                      }
                    })()}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {log.admin && <p className="text-xs font-semibold text-gray-600">{log.admin.name}</p>}
                    <p className="text-[10px] text-gray-400 font-mono">{new Date(log.createdAt).toLocaleString()}</p>
                    {log.ip && <p className="text-[10px] text-gray-300">{log.ip}</p>}
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
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
