'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useUser, UserButton, SignOutButton, useClerk } from '@clerk/nextjs'
import { usePusher } from '@/lib/usePusher'
import { GovSeal, GovHeaderLogos } from '@/components/GovernmentHeader'
import { VoiceAssistant } from '@/components/VoiceAssistant'
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
      className="glass rounded-xl border border-gray-100 p-4 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group">
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
          <button onClick={() => {
              if (window.confirm(`Check out ${log.fullName} early?

This marks their session as complete now.`)) onCheckout(log.id)
            }}
            className={`flex-1 text-xs py-1.5 rounded-lg border font-semibold transition-colors ${
              isOverdue
                ? 'bg-red-500 text-white border-red-500 hover:bg-red-600'
                : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
            }`}>
            {isOverdue ? '⚠ Force Check Out' : '🚪 Early Check-Out'}
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
      <div className="glass rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
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
      <div className="glass rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
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
  const { user, isLoaded: clerkLoaded, isSignedIn } = useUser()
  const currentAdmin = isSignedIn ? { id: user?.id ?? '', name: user?.fullName ?? user?.username ?? 'Admin', role: 'SUPER_ADMIN' } : null
  const [tab, setTab] = useState<'dashboard' | 'logs' | 'pcs' | 'network' | 'settings' | 'announcements' | 'analytics'>('dashboard')
  const [adminVoiceToast, setAdminVoiceToast] = useState<{ message: string; type: 'success'|'info'|'error' } | null>(null)

  const handleAdminVoiceCommand = (cmd: { action: string; section?: string; filter?: string; field?: string; value?: string; message?: string }) => {
    if (cmd.action === 'navigate' && cmd.section) {
      const sectionMap: Record<string, typeof tab> = {
        pcs: 'pcs', logs: 'logs', announcements: 'announcements',
        settings: 'settings', audit: 'analytics', analytics: 'analytics', dashboard: 'dashboard',
      }
      const dest = sectionMap[cmd.section]
      if (dest) { setTab(dest); setAdminVoiceToast({ message: cmd.message || `Navigated to ${dest}`, type: 'info' }) }
    } else if (cmd.action === 'show_pc_count') {
      setTab('pcs')
      setAdminVoiceToast({ message: 'Showing PC status overview', type: 'info' })
    } else if (cmd.action === 'show_stats') {
      setTab('dashboard')
      setAdminVoiceToast({ message: 'Showing dashboard statistics', type: 'info' })
    } else if (cmd.action === 'show_logs') {
      setTab('logs')
      setAdminVoiceToast({ message: cmd.message || 'Showing log entries', type: 'info' })
    } else if (cmd.message) {
      setAdminVoiceToast({ message: cmd.message, type: 'success' })
    }
    setTimeout(() => setAdminVoiceToast(null), 4000)
  }
  const [settings, setSettings] = useState({ wifiSsid: 'DICT-DTC-Free', wifiPassword: '', wifiNote: 'Free public WiFi', accessCode: '1234', officeOpen: '08:00', officeClose: '17:00', bgImageUrl: '', interactiveBannerUrl: '', googleSheetId: '', googleServiceKey: '' })
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [sheetSyncing, setSheetSyncing] = useState(false)
  const [sheetResult, setSheetResult] = useState<{ok:boolean;msg:string}|null>(null)
  const [settingsTab, setSettingsTab] = useState<'general'|'appearance'|'integrations'|'staff'|'pwa'>('general')
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [liveStats, setLiveStats] = useState<{totalEntries:number;activeNow:number;pcsOnline:number;pcsInUse:number}|null>(null)
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
    onStatsUpdate: (data: unknown) => {
      setLiveStats(data as {totalEntries:number;activeNow:number;pcsOnline:number;pcsInUse:number})
    },
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
    if (r.ok) { const d = await r.json(); setAllLogs(Array.isArray(d) ? d : (d.logs || [])) }
  }, [search, dateFilter])
  const fetchPcs = useCallback(async () => {
    const r = await fetch('/api/pcs'); if (r.ok) setPcs(await r.json())
  }, [])
  const fetchSettings = async () => {
    const r = await fetch('/api/settings')
    if (r.ok) {
      const data = await r.json()
      // Merge with defaults — API may not return all keys (e.g. bgImageUrl when unset)
      setSettings(s => ({
        ...s,
        wifiSsid: data.wifiSsid ?? s.wifiSsid,
        wifiPassword: data.wifiPassword ?? s.wifiPassword,
        wifiNote: data.wifiNote ?? s.wifiNote,
        accessCode: data.accessCode ?? s.accessCode,
        officeOpen: data.officeOpen ?? s.officeOpen,
        officeClose: data.officeClose ?? s.officeClose,
        bgImageUrl: data.bgImageUrl ?? s.bgImageUrl,
        interactiveBannerUrl: data.interactiveBannerUrl ?? s.interactiveBannerUrl,
        googleSheetId: data.googleSheetId ?? s.googleSheetId,
        googleServiceKey: data.googleServiceKey ?? s.googleServiceKey,
      }))
      // Apply bg immediately on admin page too
      if (data.bgImageUrl) {
        applyBgToPage(data.bgImageUrl)
      }
    }
  }


  const fetchLiveStats = useCallback(async () => {
    const r = await fetch('/api/stats/live')
    if (r.ok) setLiveStats(await r.json())
  }, [])

  useEffect(() => {
    if (!isSignedIn) return
    fetchStats(); fetchPcs(); fetchSettings(); fetchLogs(); fetchLiveStats()
    const t = setInterval(() => { fetchStats(); fetchPcs(); fetchLiveStats() }, 15000)
    return () => clearInterval(t)
  }, [isSignedIn, fetchStats, fetchPcs, fetchLogs])
  useEffect(() => { if (isSignedIn && tab === 'logs') fetchLogs() }, [isSignedIn, tab, fetchLogs])

  // ── Apply background CSS variable whenever settings.bgImageUrl changes ───────
  useEffect(() => {
    applyBgToPage(settings.bgImageUrl || '')
  }, [settings.bgImageUrl]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleCheckout = async (logId: string) => {
    await fetch(`/api/logs/${logId}/timeout`, { method: 'PATCH' })
    fetchLogs(); fetchStats(); fetchPcs(); fetchLiveStats()
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
  const handleSheetSync = async (from?: string, to?: string) => {
    setSheetSyncing(true); setSheetResult(null)
    try {
      const body = from && to ? { from, to } : {}
      const r = await fetch('/api/sheets/sync', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
      const d = await r.json()
      if (r.ok) setSheetResult({ ok:true, msg:`✅ Synced ${d.rowsWritten} rows to Google Sheets` })
      else setSheetResult({ ok:false, msg:`❌ ${d.error}` })
    } catch(e) { setSheetResult({ ok:false, msg:`❌ Network error` }) }
    setSheetSyncing(false)
  }

  // ── Apply background CSS variable instantly on this page ─────────────────
  const applyBgToPage = (url: string) => {
    let el = document.getElementById('dtc-admin-bg') as HTMLStyleElement | null
    if (!el) { el = document.createElement('style'); el.id = 'dtc-admin-bg'; document.head.appendChild(el) }
    el.textContent = url
      ? `:root { --bg-image: url('${url.replace(/'/g, "\\'")}') }`
      : `:root { --bg-image: url('/Bg.png') }`
  }

  const saveSettings = async () => {
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
    // Apply BG immediately so admin sees the change without page reload
    applyBgToPage(settings.bgImageUrl || '')
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

  // ── CLERK AUTH GATE ───────────────────────────────────────────────────────────
  if (!clerkLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--dict-blue)] border-t-transparent rounded-full animate-spin"/>
      </div>
    )
  }
  if (!isSignedIn) {
    if (typeof window !== 'undefined') window.location.href = '/sign-in?redirect_url=/admin'
    return null
  }

  return (
    <div className="min-h-screen" style={{position:"relative",zIndex:1,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
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
              {(['dashboard','logs','pcs','network','announcements','analytics','settings'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-all ${tab===t ? 'bg-white text-[var(--dict-blue)] shadow-sm' : 'text-blue-200 hover:text-white hover:bg-white/10'}`}>
                  {t==='pcs'?'🖥 Stations':t==='network'?'📡 Network':t==='dashboard'?'📊 Dashboard':t==='settings'?'⚙️ Settings':t==='announcements'?'📢 Notices':t==='analytics'?'📊 Analytics':'📋 Logs'}
                </button>
              ))}
            </nav>
            <div className="flex items-center gap-3">

              <UserButton afterSignOutUrl="/sign-in" appearance={{ elements: { avatarBox: 'w-8 h-8' } }}/>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6" style={{position:"relative",zIndex:1}}>

        {/* ══════════════════════════════════════════════════════════ DASHBOARD */}
        {tab === 'dashboard' && s && (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Today's Clients", value: todayLogs.length, icon: '👥', view: 'today' as DashView, bg: 'bg-[var(--dict-blue)] text-white', active: dashView === 'today' },
                { label: 'Active Now', value: liveStats?.activeNow ?? activeLogs.length, icon: '🟢', view: 'active' as DashView, bg: 'bg-emerald-600 text-white', active: dashView === 'active', live: true },
                { label: 'Total Entries', value: liveStats?.totalEntries ?? (s.total as number) ?? 0, icon: '📋', view: null, nav: 'logs', live: true },
                { label: 'PCs Online', value: (liveStats?.pcsOnline ?? (s.pcs as Record<string,number>)?.online ?? 0), icon: '🖥️', view: null, nav: 'pcs', live: true },
              ].map(c => (
                <button key={c.label} onClick={() => {
                  if (c.view) setDashView(c.view)
                  else if (c.nav) setTab(c.nav as 'logs' | 'pcs')
                }}
                  className={`${c.bg || 'bg-white'} rounded-2xl p-5 shadow-sm text-left hover:scale-[1.02] hover:shadow-md transition-all active:scale-[0.98] ${c.active ? 'ring-2 ring-offset-2 ring-[var(--dict-gold)]' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{c.icon}</span>
                    {(c as {live?:boolean}).live && <span className="flex items-center gap-1 text-[10px] text-white/60"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block"/>LIVE</span>}
                  </div>
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
                <div className="glass rounded-2xl shadow-sm p-5">
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
                  <div className="glass rounded-2xl shadow-sm p-5">
                    <BarChart data={equipmentFreq} title="Equipment Usage" color="bg-[var(--dict-blue)]"/>
                  </div>
                )}
              </div>
            </div>

            {/* Report charts row */}
            <div className="grid md:grid-cols-2 gap-5">
              <div className="glass rounded-2xl shadow-sm p-5">
                <BarChart data={purposeFreq} title="Purpose / Service Frequency" color="bg-emerald-500"/>
              </div>
              <div className="glass rounded-2xl shadow-sm p-5">
                <BarChart data={agencyFreq} title="Agency / Organization Frequency" color="bg-purple-500"/>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ LOGS */}
        {tab === 'logs' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="glass rounded-2xl shadow-sm p-4">
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
            <div className="glass rounded-2xl p-5">
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
                    <div className="glass rounded-xl px-4 py-2 border border-blue-200 text-xs text-blue-600">
                      Grid: <strong>{gridCols} × {gridRowCount}</strong> = {gridCols * gridRowCount} cells total · {pcs.length} stations placed
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Floor Plan Grid */}
            <div className="glass rounded-2xl shadow-sm p-5">
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
              <div className="glass rounded-2xl p-5">
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
              <div className="glass rounded-2xl p-5">
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
              <div className="glass rounded-2xl p-5">
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
        {tab === 'settings' && (
          <div className="space-y-5">
            {/* Sub-nav */}
            <div className="glass rounded-2xl p-1.5 flex gap-1 flex-wrap shadow-sm">
              {([
                ['general',      '⚙️', 'General'],
                ['appearance',   '🎨', 'Appearance'],
                ['integrations', '🔗', 'Integrations'],
                ['staff',        '👥', 'Staff & Auth'],
                ['pwa',          '📱', 'PWA & Offline'],
              ] as const).map(([k,ic,lb]) => (
                <button key={k} onClick={() => setSettingsTab(k)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${settingsTab===k ? 'bg-[var(--dict-blue)] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>
                  <span>{ic}</span><span>{lb}</span>
                </button>
              ))}
            </div>

            {settingsSaved && (
              <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 flex items-center gap-2 text-green-700 text-sm font-semibold">
                ✅ Settings saved! Changes take effect immediately.
              </div>
            )}

            {/* ─── GENERAL ─────────────────────────────────────────────── */}
            {settingsTab === 'general' && (
              <div className="grid lg:grid-cols-2 gap-5">
                {/* Access code */}
                <div className="glass rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-8 h-8 rounded-lg bg-blue-100 text-[var(--dict-blue)] flex items-center justify-center">🔐</span>
                    <h3 className="font-display font-semibold text-gray-700">Daily Access Code</h3>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">Change this daily. Clients must enter this before using the logbook.</p>
                  <div className="flex gap-3 items-stretch">
                    <input type="text" value={settings.accessCode}
                      onChange={e=>setSettings(s=>({...s,accessCode:e.target.value}))}
                      maxLength={10}
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-3xl font-mono tracking-widest text-center outline-none focus:border-[var(--dict-blue)]"/>
                    <div className="flex flex-col gap-2">
                      <button onClick={()=>setSettings(s=>({...s,accessCode:Math.floor(1000+Math.random()*9000).toString()}))}
                        className="px-4 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-500 hover:bg-gray-50 font-medium">🎲 4-digit</button>
                      <button onClick={()=>setSettings(s=>({...s,accessCode:Math.floor(100000+Math.random()*900000).toString()}))}
                        className="px-4 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-500 hover:bg-gray-50 font-medium">🎲 6-digit</button>
                    </div>
                  </div>
                </div>

                {/* Office hours */}
                <div className="glass rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">⏰</span>
                    <h3 className="font-display font-semibold text-gray-700">Office Hours</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    {([{label:'Opens at',key:'officeOpen',color:'text-green-600'},{label:'Closes at',key:'officeClose',color:'text-red-500'}] as const).map(({label,key,color})=>(
                      <div key={key}>
                        <label className={`text-xs font-semibold ${color} block mb-1`}>{label}</label>
                        <input type="time" value={(settings as Record<string,string>)[key]}
                          onChange={e=>setSettings(s=>({...s,[key]:e.target.value}))}
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-[var(--dict-blue)]"/>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 text-center">Logbook blocks access outside these hours.</p>
                </div>

                {/* WiFi */}
                <div className="glass rounded-2xl p-6 shadow-sm lg:col-span-2">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">📶</span>
                    <h3 className="font-display font-semibold text-gray-700">WiFi Settings</h3>
                  </div>
                  <div className="grid lg:grid-cols-2 gap-5">
                    <div className="space-y-3">
                      {([
                        {label:'Network Name (SSID)',key:'wifiSsid',ph:'DICT-DTC-Free',mono:true},
                        {label:'Password (blank = open)',key:'wifiPassword',ph:'Leave blank for open network',mono:true},
                        {label:'Note shown to clients',key:'wifiNote',ph:'Free public WiFi for DTC clients',mono:false},
                      ] as const).map(f=>(
                        <div key={f.key}>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">{f.label}</label>
                          <input value={(settings as Record<string,string>)[f.key]} placeholder={f.ph}
                            onChange={e=>setSettings(s=>({...s,[f.key]:e.target.value}))}
                            className={`w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] ${f.mono?'font-mono':''}`}/>
                        </div>
                      ))}
                    </div>
                    {settings.wifiSsid && (
                      <div className="bg-[var(--dict-blue)] rounded-2xl p-5 flex items-center gap-4">
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(settings.wifiPassword?`WIFI:T:WPA;S:${settings.wifiSsid};P:${settings.wifiPassword};;`:`WIFI:T:nopass;S:${settings.wifiSsid};;;`)}`}
                          className="w-20 h-20 rounded-xl border-4 border-white/30" alt="WiFi QR"/>
                        <div className="text-white">
                          <p className="font-display font-bold text-base">{settings.wifiSsid}</p>
                          <p className="text-blue-200 text-sm">{settings.wifiPassword||'Open network'}</p>
                          <p className="text-blue-300 text-xs mt-1">{settings.wifiNote}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <button onClick={saveSettings}
                    className="w-full py-4 bg-[var(--dict-blue)] text-white font-bold rounded-2xl hover:bg-blue-800 shadow-lg shadow-blue-100 text-base flex items-center justify-center gap-2">
                    💾 Save General Settings
                  </button>
                </div>
              </div>
            )}

            {/* ─── APPEARANCE ──────────────────────────────────────────── */}
            {settingsTab === 'appearance' && (
              <div className="space-y-5">

                {/* ── BACKGROUND IMAGE ── */}
                <div className="glass rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">🖼</span>
                    <h3 className="font-display font-semibold text-gray-700">Background Image</h3>
                    <span className="ml-auto text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">Applies to both Admin & Front Page</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">
                    Upload a PNG/JPG file <strong>or</strong> paste an image URL. Falls back to <code className="bg-gray-100 px-1 rounded">/Bg.png</code> if blank.
                  </p>

                  {/* File upload */}
                  <label className="flex items-center gap-3 w-full mb-3 cursor-pointer">
                    <div className="flex-1 border-2 border-dashed border-gray-200 hover:border-[var(--dict-blue)] rounded-xl px-4 py-3 flex items-center gap-3 transition-colors">
                      <span className="text-2xl">📁</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Upload PNG / JPG</p>
                        <p className="text-xs text-gray-400">Max 4MB. Stored in database, applies immediately.</p>
                      </div>
                    </div>
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = ev => setSettings(s => ({ ...s, bgImageUrl: ev.target?.result as string }))
                        reader.readAsDataURL(file)
                      }}/>
                  </label>

                  {/* URL input */}
                  <div className="flex gap-2 mb-4">
                    <input value={(settings.bgImageUrl||'').startsWith('data:') ? '' : settings.bgImageUrl}
                      onChange={e => setSettings(s=>({...s,bgImageUrl:e.target.value}))}
                      placeholder="Or paste image URL (https://...)"
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--dict-blue)] font-mono"/>
                    {settings.bgImageUrl && (
                      <button onClick={() => setSettings(s=>({...s,bgImageUrl:''}))}
                        className="px-3 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 text-sm">✕</button>
                    )}
                  </div>

                  {/* Live preview */}
                  <div className="relative rounded-2xl overflow-hidden h-40 border-2 border-dashed border-gray-200">
                    <div className="absolute inset-0"
                      style={{ backgroundImage:`url('${settings.bgImageUrl||"/Bg.png"}')`, backgroundSize:'cover', backgroundPosition:'center' }}/>
                    <div className="absolute inset-0 bg-indigo-100/50 backdrop-blur-sm"/>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="glass rounded-xl px-6 py-2 text-sm font-semibold text-gray-700 shadow">
                        {settings.bgImageUrl ? ((settings.bgImageUrl||'').startsWith('data:') ? '📁 Uploaded file' : '🔗 URL') : '🖼 Default /Bg.png'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">📌 Fallback Chain</p>
                    <ol className="text-xs text-blue-600 space-y-0.5 list-decimal list-inside">
                      <li>Uploaded file or URL saved here → applied at page load via DB</li>
                      <li>Hardcoded <code>/Bg.png</code> in <code>globals.css</code> (always present)</li>
                      <li>Solid color <code>#eef2ff</code> if both fail</li>
                    </ol>
                  </div>
                </div>

                {/* ── INTERACTIVE BANNER ── */}
                <div className="glass rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">✨</span>
                    <h3 className="font-display font-semibold text-gray-700">Interactive Banner</h3>
                    <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">Front Page Sidebar</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">
                    Shown below "What We Offer" on the client-facing page. Mouse-interactive 3D parallax effect. Name the file <code className="bg-gray-100 px-1 rounded">interactive-banner.jpg</code> or upload below.
                  </p>

                  {/* File upload */}
                  <label className="flex items-center gap-3 w-full mb-3 cursor-pointer">
                    <div className="flex-1 border-2 border-dashed border-amber-200 hover:border-amber-400 rounded-xl px-4 py-3 flex items-center gap-3 transition-colors">
                      <span className="text-2xl">🎨</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Upload Banner PNG / JPG</p>
                        <p className="text-xs text-gray-400">Recommended: 380×220px or 16:9. Max 4MB.</p>
                      </div>
                    </div>
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = ev => setSettings(s => ({ ...s, interactiveBannerUrl: ev.target?.result as string }))
                        reader.readAsDataURL(file)
                      }}/>
                  </label>

                  <div className="flex gap-2 mb-4">
                    <input value={(settings.interactiveBannerUrl||'').startsWith('data:') ? '' : (settings.interactiveBannerUrl||'')}
                      onChange={e => setSettings(s=>({...s,interactiveBannerUrl:e.target.value}))}
                      placeholder="Or paste image URL — leave blank to use /interactive-banner.jpg"
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-400 font-mono"/>
                    {settings.interactiveBannerUrl && (
                      <button onClick={() => setSettings(s=>({...s,interactiveBannerUrl:''}))}
                        className="px-3 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 text-sm">✕</button>
                    )}
                  </div>

                  {/* Preview */}
                  {(settings.interactiveBannerUrl || true) && (
                    <div className="relative rounded-2xl overflow-hidden h-32 border-2 border-dashed border-amber-200 bg-amber-50">
                      <div className="absolute inset-0"
                        style={{ backgroundImage:`url('${settings.interactiveBannerUrl||"/interactive-banner.jpg"}')`, backgroundSize:'cover', backgroundPosition:'center' }}/>
                      <div className="absolute inset-0 bg-black/20"/>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-white/80 backdrop-blur rounded-lg px-4 py-1.5 text-xs font-semibold text-gray-700">
                          {settings.interactiveBannerUrl ? 'Banner Preview' : 'Using /interactive-banner.jpg'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick backgrounds */}
                <div className="glass rounded-2xl p-6 shadow-sm">
                  <h3 className="font-display font-semibold text-gray-700 mb-3">Quick Backgrounds</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {[
                      { label:'Default /Bg.png', url:'' },
                      { label:'DICT Blue', url:'https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&q=80' },
                      { label:'PH Mountains', url:'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1920&q=80' },
                      { label:'Manila Bay', url:'https://images.unsplash.com/photo-1533421644343-45b606750db8?w=1920&q=80' },
                      { label:'Abstract Blue', url:'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1920&q=80' },
                      { label:'Government', url:'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1920&q=80' },
                      { label:'Tech Circuit', url:'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=80' },
                      { label:'Clean White', url:'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&q=80' },
                    ].map(bg => (
                      <button key={bg.label} onClick={() => setSettings(s=>({...s,bgImageUrl:bg.url}))}
                        className={`rounded-xl overflow-hidden border-2 transition-all hover:scale-105 ${settings.bgImageUrl===bg.url ? 'border-[var(--dict-blue)] shadow-md' : 'border-gray-200'}`}>
                        <div className="h-16 relative">
                          {bg.url
                            ? <div className="absolute inset-0" style={{backgroundImage:`url(${bg.url})`,backgroundSize:'cover',backgroundPosition:'center'}}/>
                            : <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"><span className="text-2xl">🏠</span></div>
                          }
                        </div>
                        <div className="p-1.5 bg-white text-[10px] text-gray-500 font-medium truncate">{bg.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={saveSettings}
                  className="w-full py-4 bg-[var(--dict-blue)] text-white font-bold rounded-2xl hover:bg-blue-800 shadow-lg text-base flex items-center justify-center gap-2">
                  💾 Save Appearance (applies to Admin + Front Page)
                </button>
              </div>
            )}

            {/* ─── INTEGRATIONS ────────────────────────────────────────── */}
            {settingsTab === 'integrations' && (
              <div className="space-y-5">
                {/* Google Sheets */}
                <div className="glass rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-xl flex-shrink-0">📊</span>
                    <div>
                      <h3 className="font-display font-semibold text-gray-800">Google Sheets Integration</h3>
                      <p className="text-xs text-gray-400">Push all log entries to a Google Spreadsheet with one click.</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Google Sheet ID</label>
                      <input value={settings.googleSheetId}
                        onChange={e=>setSettings(s=>({...s,googleSheetId:e.target.value}))}
                        placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-[var(--dict-blue)]"/>
                      <p className="text-xs text-gray-400 mt-1">From the sheet URL: <code className="bg-gray-100 px-1 rounded">spreadsheets/d/<strong>THIS_PART</strong>/edit</code></p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Service Account JSON Key</label>
                      <textarea value={settings.googleServiceKey}
                        onChange={e=>setSettings(s=>({...s,googleServiceKey:e.target.value}))}
                        rows={5} placeholder={`Paste the full contents of your service-account-key.json here:
{
  "type": "service_account",
  "project_id": "...",
  "client_email": "...",
  "private_key": "..."
}`}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-[var(--dict-blue)] resize-none"/>
                    </div>

                    {sheetResult && (
                      <div className={`p-3 rounded-xl border text-sm font-medium ${sheetResult.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                        {sheetResult.msg}
                      </div>
                    )}

                    <div className="flex gap-3 flex-wrap">
                      <button onClick={saveSettings}
                        className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 transition-colors">
                        💾 Save Credentials
                      </button>
                      <button onClick={() => handleSheetSync()} disabled={sheetSyncing || !settings.googleSheetId}
                        className="flex-[2] py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                        {sheetSyncing ? <><Spinner/>Syncing…</> : <>📊 Sync All Logs Now</>}
                      </button>
                    </div>
                  </div>

                  {/* Setup guide */}
                  <details className="mt-5">
                    <summary className="text-xs font-semibold text-[var(--dict-blue)] cursor-pointer hover:underline">
                      📖 How to set up Google Sheets integration →
                    </summary>
                    <div className="mt-3 space-y-2 text-xs text-gray-600 leading-relaxed">
                      {[
                        ['1','Go to Google Cloud Console → APIs & Services → Enable "Google Sheets API"'],
                        ['2','Create a Service Account → download the JSON key file'],
                        ['3','Open your target Google Sheet → Share → paste the service account email (Editor access)'],
                        ['4','Copy the Sheet ID from the URL and paste above'],
                        ['5','Paste the full JSON key contents above and click Save, then Sync'],
                      ].map(([n,t])=>(
                        <div key={n} className="flex gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-[var(--dict-blue)] text-[10px] font-bold flex items-center justify-center flex-shrink-0">{n}</span>
                          <span>{t}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>

                {/* Future integrations placeholder */}
                <div className="glass rounded-2xl p-5 border border-dashed border-gray-200">
                  <div className="flex items-center gap-3 opacity-50">
                    <span className="text-2xl">🔌</span>
                    <div>
                      <p className="font-semibold text-gray-700 text-sm">More Integrations Coming</p>
                      <p className="text-xs text-gray-400">Google Data Studio, Power BI, email reports — planned.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── STAFF & AUTH ─────────────────────────────────────────── */}
            {settingsTab === 'staff' && (
              <AdminsTab currentAdminId={currentAdmin?.id ?? ''}/>
            )}

            {/* ─── PWA & OFFLINE ────────────────────────────────────────── */}
            {settingsTab === 'pwa' && (
              <div className="space-y-5">
                {/* Install status */}
                <div className="glass rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl">📱</span>
                    <div>
                      <h3 className="font-display font-semibold text-gray-800">Progressive Web App</h3>
                      <p className="text-xs text-gray-400">Install the logbook as a native-like app on any device.</p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { icon:'🔒', title:'HTTPS + TLS', desc:'Served securely over Railway\'s managed TLS.' },
                      { icon:'📋', title:'Web Manifest', desc:'Full manifest.json with icons, shortcuts, and display mode.' },
                      { icon:'⚡', title:'Service Worker', desc:'next-pwa generates a service worker with intelligent caching.' },
                      { icon:'📦', title:'Offline Cache', desc:'Pages and API responses cached — dashboard works offline.' },
                    ].map(f=>(
                      <div key={f.title} className="flex items-start gap-3 p-3 rounded-xl bg-green-50 border border-green-100">
                        <span className="text-lg flex-shrink-0">{f.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-green-800">{f.title}</p>
                          <p className="text-xs text-green-600">{f.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Install instructions */}
                <div className="glass rounded-2xl p-6 shadow-sm">
                  <h3 className="font-display font-semibold text-gray-700 mb-4">How to Install</h3>
                  <div className="grid sm:grid-cols-3 gap-4">
                    {[
                      { os:'🖥 Desktop (Chrome/Edge)', steps:['Open the logbook URL in Chrome or Edge','Look for the install icon (⊕) in the address bar','Click it and choose "Install"','The app opens in its own window'] },
                      { os:'📱 Android (Chrome)', steps:['Open in Chrome mobile','Tap the ⋮ menu','Select "Add to Home Screen"','Follow the prompt'] },
                      { os:'🍎 iPhone / iPad (Safari)', steps:['Open in Safari','Tap the Share button (□↑)','Scroll down to "Add to Home Screen"','Tap Add'] },
                    ].map(item=>(
                      <div key={item.os} className="bg-gray-50 rounded-xl p-4">
                        <p className="font-semibold text-gray-700 text-sm mb-3">{item.os}</p>
                        <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
                          {item.steps.map(s=><li key={s}>{s}</li>)}
                        </ol>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cache info */}
                <div className="glass rounded-2xl p-6 shadow-sm">
                  <h3 className="font-display font-semibold text-gray-700 mb-3">Cache Strategy</h3>
                  <div className="space-y-2">
                    {[
                      { route:'/api/settings, /api/pcs, /api/stats', strategy:'NetworkFirst (8s timeout)', ttl:'24 hours', color:'bg-blue-50 border-blue-100' },
                      { route:'/api/logs', strategy:'StaleWhileRevalidate', ttl:'24 hours', color:'bg-amber-50 border-amber-100' },
                      { route:'Static assets (images, fonts)', strategy:'CacheFirst', ttl:'30 days', color:'bg-green-50 border-green-100' },
                      { route:'All other pages', strategy:'NetworkFirst (10s)', ttl:'24 hours', color:'bg-gray-50 border-gray-100' },
                    ].map(r=>(
                      <div key={r.route} className={`p-3 rounded-xl border ${r.color} flex items-center gap-3`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono font-semibold text-gray-700 truncate">{r.route}</p>
                          <p className="text-xs text-gray-500">{r.strategy} · TTL: {r.ttl}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Offline queue */}
                <div className="glass rounded-2xl p-6 shadow-sm">
                  <h3 className="font-display font-semibold text-gray-700 mb-2">Offline Log Queue</h3>
                  <p className="text-xs text-gray-400 mb-3">
                    When the client-facing logbook submits an entry while offline, it is queued in localStorage and automatically synced when internet is restored.
                  </p>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                    <p className="text-xs text-indigo-700 font-semibold mb-1">Implementation</p>
                    <p className="text-xs text-indigo-600">Handled by <code>/src/lib/offlineQueue.ts</code> — queues POST /api/logs payloads and re-submits on reconnect via the Navigator online event.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {tab === 'announcements' && (
          <AnnouncementsTab/>
        )}
        {tab === 'analytics' && (
          <AnalyticsTab/>
        )}

      </main>

      {/* Admin Voice Toast */}
      {adminVoiceToast && (
        <div className="fixed top-4 right-4 z-[70]">
          <div className={`rounded-xl shadow-2xl px-5 py-3 flex items-center gap-3 text-white ${
            adminVoiceToast.type === 'success' ? 'bg-green-600' :
            adminVoiceToast.type === 'error' ? 'bg-red-600' : 'bg-[var(--dict-blue)]'
          }`}>
            <span className="text-lg">{adminVoiceToast.type === 'success' ? '✓' : 'ℹ'}</span>
            <span className="font-semibold text-sm">{adminVoiceToast.message}</span>
          </div>
        </div>
      )}

      {/* Admin Voice Assistant - full system access */}
      <VoiceAssistant
        context="admin"
        onCommand={handleAdminVoiceCommand}
      />
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
      <div className="glass rounded-2xl p-5">
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
      <div className="glass rounded-2xl p-5">
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

// ── AdminsTab — Clerk-based staff management ──────────────────────────────────
function AdminsTab({ currentAdminId }: { currentAdminId: string }) {
  const { user } = useUser()
  const [invites, setInvites] = useState<{id:string;emailAddress:string|null;status:string;createdAt:string;url?:string}[]>([])
  const [emails, setEmails] = useState('')
  const [sending, setSending] = useState(false)
  const [genLink, setGenLink] = useState(false)
  const [success, setSuccess] = useState('')
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState<string|null>(null)
  const [mode, setMode] = useState<'email'|'link'>('email')

  const loadInvites = () =>
    fetch('/api/invitations').then(r=>r.json()).then(d=>{ if(d.invitations) setInvites(d.invitations) }).catch(()=>{})
  useEffect(() => { loadInvites() }, [])

  const sendInvites = async () => {
    setErr(''); setSuccess('')
    const list = emails.split(/[\n,;]/).map(e=>e.trim()).filter(Boolean)
    if (!list.length) return setErr('Enter at least one email')
    setSending(true)
    try {
      const r = await fetch('/api/invitations', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({emails:list}) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error||'Failed')
      setInvites(p=>[...d.invitations,...p]); setSuccess(`${d.invitations.length} invitation(s) sent!`); setEmails('')
    } catch(e) { setErr((e as Error).message) }
    setSending(false)
  }

  const generateLink = async () => {
    setErr(''); setGenLink(true)
    try {
      const r = await fetch('/api/invitations/link', { method:'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error||'Failed')
      setInvites(p=>[d.invitation,...p]); setSuccess('Link generated — copy it below.')
    } catch(e) { setErr((e as Error).message) }
    setGenLink(false)
  }

  const revoke = async (id: string) => {
    await fetch(`/api/invitations/${id}`, { method:'DELETE' })
    setInvites(p=>p.filter(i=>i.id!==id))
  }

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text); setCopied(id); setTimeout(()=>setCopied(null), 2500)
  }

  const pending  = invites.filter(i=>i.status==='pending').length
  const accepted = invites.filter(i=>i.status==='accepted').length

  return (
    <div className="space-y-5">
      {/* Current user card */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--dict-blue)] to-blue-500 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-md">
            {(user?.fullName?.[0] ?? user?.username?.[0] ?? 'A').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-bold text-gray-800 text-base">{user?.fullName ?? user?.username}</p>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">You · Admin</span>
            </div>
            <p className="text-sm text-gray-400">{user?.primaryEmailAddress?.emailAddress}</p>
            <p className="text-xs text-gray-300 mt-0.5">
              Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'}) : '—'}
            </p>
          </div>
          <a href="/admin/auth-guide" className="text-xs px-3 py-2 rounded-xl border border-blue-200 text-[var(--dict-blue)] bg-blue-50 hover:bg-blue-100 font-semibold transition-colors flex-shrink-0">
            🔐 Auth Guide
          </a>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:'Pending', value:pending,  icon:'⏳', color:'text-amber-600',  bg:'bg-amber-50  border-amber-200'  },
          { label:'Accepted',value:accepted, icon:'✅', color:'text-green-600',  bg:'bg-green-50  border-green-200'  },
          { label:'Total',   value:invites.length, icon:'📋', color:'text-blue-600', bg:'bg-blue-50 border-blue-200' },
        ].map(s=>(
          <div key={s.label} className={`glass rounded-2xl p-4 border ${s.bg} text-center`}>
            <div className="text-xl mb-1">{s.icon}</div>
            <div className={`text-2xl font-bold font-display ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Send invite form */}
        <div className="glass rounded-2xl p-5">
          <h3 className="font-display font-semibold text-gray-800 text-base mb-1">Invite Staff Member</h3>
          <p className="text-xs text-gray-400 mb-4">Only invited accounts can sign up. Invitations are sent via Clerk.</p>

          {/* Mode toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
            {(['email','link'] as const).map(m=>(
              <button key={m} onClick={()=>setMode(m)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode===m?'bg-white text-[var(--dict-blue)] shadow-sm':'text-gray-500'}`}>
                {m==='email'?'📧 By Email':'🔗 One-time Link'}
              </button>
            ))}
          </div>

          {mode==='email' ? (
            <>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Email Addresses</label>
              <textarea value={emails} onChange={e=>setEmails(e.target.value)} rows={4}
                placeholder={"staff@dict.gov.ph\njuan@dict.gov.ph"}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-[var(--dict-blue)] resize-none mb-1"/>
              <p className="text-xs text-gray-400 mb-4">Separate with commas, semicolons, or new lines</p>
              <button onClick={sendInvites} disabled={sending||!emails.trim()}
                className="w-full py-3 rounded-xl bg-[var(--dict-blue)] text-white font-bold text-sm disabled:opacity-50 hover:bg-blue-800 transition-colors">
                {sending?'Sending…':'✉️ Send Invitations'}
              </button>
            </>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4 text-sm text-blue-700">
                Generate a <strong>7-day one-time link</strong>. Anyone with it can create a staff account.
              </div>
              <button onClick={generateLink} disabled={genLink}
                className="w-full py-3 rounded-xl bg-[var(--dict-blue)] text-white font-bold text-sm disabled:opacity-50 hover:bg-blue-800 transition-colors">
                {genLink?'Generating…':'🔗 Generate Link'}
              </button>
            </>
          )}

          {err     && <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">⚠️ {err}</div>}
          {success && <div className="mt-3 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">✅ {success}</div>}
        </div>

        {/* Invite list */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-gray-800 text-base">All Invitations</h3>
            <span className="text-xs text-gray-400">{invites.length} total</span>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {invites.length===0
              ? <p className="text-center text-gray-300 py-8 text-sm">No invitations yet</p>
              : invites.map(inv=>{
                const sm = inv.status==='accepted'
                  ? {color:'text-green-700',bg:'bg-green-50 border-green-200',label:'Accepted'}
                  : inv.status==='revoked'
                  ? {color:'text-red-600',bg:'bg-red-50 border-red-200',label:'Revoked'}
                  : {color:'text-amber-700',bg:'bg-amber-50 border-amber-200',label:'Pending'}
                return (
                  <div key={inv.id} className="p-3 rounded-xl border border-gray-100 bg-white/60">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-gray-800 truncate flex-1">{inv.emailAddress??'🔗 Link invite'}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex-shrink-0 ${sm.bg} ${sm.color}`}>{sm.label}</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{new Date(inv.createdAt).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})}</p>
                    <div className="flex gap-2">
                      {inv.url && (
                        <button onClick={()=>copy(inv.url!,inv.id)}
                          className="flex-1 text-xs py-1.5 rounded-lg border border-blue-200 text-[var(--dict-blue)] bg-blue-50 hover:bg-blue-100 font-semibold">
                          {copied===inv.id?'✅ Copied!':'📋 Copy Link'}
                        </button>
                      )}
                      {inv.status==='pending' && (
                        <button onClick={()=>revoke(inv.id)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 bg-red-50 hover:bg-red-100 font-semibold">
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            }
          </div>
        </div>
      </div>

      {/* Clerk profile portal link */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-xl flex-shrink-0">🔐</div>
          <div className="flex-1">
            <h3 className="font-display font-semibold text-gray-800 mb-0.5">Clerk Profile Settings</h3>
            <p className="text-xs text-gray-400">Update your name, email, password, or enable two-factor authentication via Clerk&apos;s secure portal.</p>
          </div>
          <UserButton
            afterSignOutUrl="/sign-in"
            appearance={{ elements: { avatarBox: 'w-10 h-10', userButtonPopoverCard: 'rounded-2xl shadow-2xl' } }}
            showName
          />
        </div>
      </div>

      {/* Auth guide cards */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { href:'/admin/invite', icon:'✉️', title:'Full Invite Manager', desc:'Manage all invitations in a dedicated page with advanced controls.' },
          { href:'/admin/auth-guide', icon:'📖', title:'Auth Guide', desc:'Step-by-step guide for staff on how to sign in, sign up, and reset passwords.' },
          { href:'/sign-in', icon:'🔑', title:'Sign In Page', desc:'The staff login page. Share this URL with your team.' },
        ].map(l=>(
          <a key={l.href} href={l.href} className="glass rounded-2xl p-4 hover:border-blue-200 hover:shadow-md transition-all border border-white/70">
            <div className="text-2xl mb-2">{l.icon}</div>
            <p className="font-semibold text-gray-800 text-sm mb-1">{l.title}</p>
            <p className="text-xs text-gray-400">{l.desc}</p>
          </a>
        ))}
      </div>
    </div>
  )
}


// ── AnalyticsTab (unified Analytics + Audit Trail) ────────────────────────────
function AnalyticsTab() {
  const [subTab, setSubTab] = useState<'overview'|'audit'>('overview')

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher */}
      <div className="glass rounded-2xl p-1.5 flex gap-1 w-fit shadow-sm">
        {([
          { id: 'overview', icon: '📈', label: 'Overview' },
          { id: 'audit',    icon: '🔍', label: 'Audit Trail' },
        ] as const).map(({ id, icon, label }) => (
          <button key={id} onClick={() => setSubTab(id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
              subTab === id
                ? 'bg-[var(--dict-blue)] text-white shadow-md'
                : 'text-gray-500 hover:bg-gray-100'
            }`}>
            {icon} {label}
          </button>
        ))}
      </div>

      {subTab === 'overview' && <AnalyticsOverview/>}
      {subTab === 'audit'    && <AuditTrail/>}
    </div>
  )
}

// ── Analytics Overview ─────────────────────────────────────────────────────────
function AnalyticsOverview() {
  const [range, setRange] = useState<'today'|'week'|'month'|'year'|'all'>('week')
  const [data, setData]   = useState<Record<string,unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/stats?range=${range}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [range])

  const purposes       = (data?.byPurpose       as {purpose:string;count:number}[])   || []
  const agencies       = (data?.byAgency         as {agency:string;count:number}[])    || []
  const equipment      = (data?.byEquipment      as {equipment:string;count:number}[]) || []
  const byHour         = (data?.byHour           as {hour:number;count:number}[])      || []
  const dailyTrend     = (data?.dailyTrend       as {day:string;count:number}[])       || []
  const ratingDist     = (data?.ratingDist       as {rating:number;count:number}[])    || []
  const serviceTypes   = (data?.byServiceType    as {type:string;count:number}[])      || []
  const durBuckets     = (data?.durationBuckets  as {bucket:string;count:number}[])    || []
  const summary        = (data?.summary          as Record<string,number|null>)         || {}

  const maxHour = Math.max(1, ...byHour.map(h => h.count))
  const maxDay  = Math.max(1, ...dailyTrend.map(d => d.count))
  const maxDur  = Math.max(1, ...durBuckets.map(d => d.count))

  const RANGE_LABELS = { today: 'Today', week: 'This Week', month: 'This Month', year: 'This Year', all: 'All Time' }

  const trendBadge = (val: number | null | undefined) => {
    if (val == null) return null
    const up = val >= 0
    return (
      <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${up ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
        {up ? '▲' : '▼'} {Math.abs(val)}%
      </span>
    )
  }

  const HOUR_COLOR = (pct: number) => {
    if (pct > 70) return 'bg-[var(--dict-blue)]'
    if (pct > 40) return 'bg-blue-400'
    if (pct > 15) return 'bg-blue-200'
    return 'bg-gray-200'
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="glass rounded-2xl p-4 flex items-center gap-2 flex-wrap shadow-sm">
        <div className="flex gap-1 flex-wrap">
          {(['today','week','month','year','all'] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                range === r
                  ? 'bg-[var(--dict-blue)] text-white shadow'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        <a href="/api/logs/export?all=true" target="_blank" rel="noreferrer"
          className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
          ⬇ Export CSV
        </a>
      </div>

      {loading ? (
        <div className="glass rounded-2xl p-16 text-center shadow-sm">
          <div className="w-10 h-10 border-4 border-[var(--dict-blue)] border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
          <p className="text-gray-400 text-sm">Loading analytics…</p>
        </div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Total Clients',
                value: summary.total ?? 0,
                sub: summary.trend != null ? trendBadge(summary.trend as number) : null,
                icon: '👥', color: 'text-[var(--dict-blue)]', bg: 'bg-blue-50',
              },
              {
                label: 'Active Now',
                value: summary.active ?? 0,
                sub: <span className="text-[10px] text-green-600">live sessions</span>,
                icon: '🟢', color: 'text-green-600', bg: 'bg-green-50',
              },
              {
                label: 'Avg Session',
                value: summary.avgDurationMins ? `${summary.avgDurationMins}m` : '—',
                sub: <span className="text-[10px] text-purple-500">per client</span>,
                icon: '⏱', color: 'text-purple-600', bg: 'bg-purple-50',
              },
              {
                label: 'Satisfaction',
                value: summary.avgRating ? `${summary.avgRating}★` : '—',
                sub: summary.ratingCount ? <span className="text-[10px] text-amber-600">{summary.ratingCount} ratings</span> : null,
                icon: '⭐', color: 'text-amber-600', bg: 'bg-amber-50',
              },
            ].map(s => (
              <div key={s.label} className={`glass rounded-2xl p-4 shadow-sm border border-white/80 ${s.bg}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl">{s.icon}</span>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{RANGE_LABELS[range]}</span>
                </div>
                <div className={`text-2xl font-bold font-display ${s.color}`}>{String(s.value)}</div>
                <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  {s.label} {s.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Second row: Completion rate + service type + equipment */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass rounded-2xl p-4 shadow-sm text-center">
              {/* Donut-style completion ring */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Completion Rate</p>
              <div className="relative inline-flex items-center justify-center">
                <svg width="72" height="72" viewBox="0 0 72 72">
                  <circle cx="36" cy="36" r="28" fill="none" stroke="#e2e8f0" strokeWidth="8"/>
                  <circle cx="36" cy="36" r="28" fill="none" stroke="var(--dict-blue)" strokeWidth="8"
                    strokeDasharray={`${((summary.completionRate as number) ?? 0) / 100 * 175.9} 175.9`}
                    strokeLinecap="round" transform="rotate(-90 36 36)"/>
                </svg>
                <span className="absolute text-sm font-bold text-gray-700">{summary.completionRate ?? 0}%</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{summary.checkedOut ?? 0} checked out</p>
            </div>

            <div className="glass rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Service Mode</p>
              {serviceTypes.length === 0
                ? <p className="text-xs text-gray-300 text-center py-4">No data</p>
                : serviceTypes.map(s => {
                    const total = serviceTypes.reduce((a, x) => a + x.count, 0) || 1
                    const pct = Math.round((s.count / total) * 100)
                    return (
                      <div key={s.type} className="mb-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600">{s.type === 'SELF_SERVICE' ? '🙋 Self-Service' : '👨‍💼 Assisted'}</span>
                          <span className="font-bold text-gray-700">{pct}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-2 rounded-full ${s.type === 'SELF_SERVICE' ? 'bg-blue-400' : 'bg-teal-400'}`} style={{ width: `${pct}%` }}/>
                        </div>
                      </div>
                    )
                  })
              }
            </div>

            <div className="glass rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Equipment Used</p>
              <div className="space-y-1.5">
                {equipment.slice(0, 5).map(e => {
                  const max = equipment[0]?.count || 1
                  return (
                    <div key={e.equipment} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-600 w-28 truncate">{e.equipment}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-2 bg-indigo-400 rounded-full" style={{ width: `${(e.count / max) * 100}%` }}/>
                      </div>
                      <span className="text-[10px] font-bold text-gray-500 w-5 text-right">{e.count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Charts Row ── */}
          <div className="grid sm:grid-cols-2 gap-4">

            {/* Daily trend bar chart */}
            <div className="glass rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-gray-700 text-sm">Daily Client Volume</h3>
                <span className="text-[10px] text-gray-400">{RANGE_LABELS[range]}</span>
              </div>
              {dailyTrend.length === 0
                ? <p className="text-xs text-gray-300 text-center py-10">No data for this period</p>
                : (
                  <div className="flex items-end gap-0.5 h-28 overflow-x-auto pb-1">
                    {dailyTrend.map(d => {
                      const pct = maxDay > 0 ? (d.count / maxDay) * 100 : 0
                      const isToday = d.day === new Date().toISOString().slice(0, 10)
                      return (
                        <div key={d.day} className="flex-1 min-w-[16px] flex flex-col items-center gap-0.5 group" title={`${d.day}: ${d.count}`}>
                          <span className="text-[8px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">{d.count}</span>
                          <div className={`w-full rounded-t transition-all ${isToday ? 'bg-[var(--dict-blue)]' : 'bg-blue-300 hover:bg-blue-400'}`}
                            style={{ height: `${Math.max(3, pct)}%` }}/>
                          <span className="text-[8px] text-gray-300 -rotate-45 origin-top-left">{d.day.slice(5)}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              }
            </div>

            {/* Hourly heatmap */}
            <div className="glass rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-gray-700 text-sm">Peak Hours</h3>
                <div className="flex gap-1 items-center">
                  <div className="w-2 h-2 rounded-sm bg-gray-200"/><span className="text-[9px] text-gray-400">Low</span>
                  <div className="w-2 h-2 rounded-sm bg-blue-400 ml-1"/><span className="text-[9px] text-gray-400">Mid</span>
                  <div className="w-2 h-2 rounded-sm bg-[var(--dict-blue)] ml-1"/><span className="text-[9px] text-gray-400">High</span>
                </div>
              </div>
              <div className="space-y-1">
                {Array.from({ length: 9 }, (_, i) => i + 8).map(h => {
                  const entry = byHour.find(e => e.hour === h)
                  const count = entry?.count ?? 0
                  const pct   = Math.round((count / maxHour) * 100)
                  return (
                    <div key={h} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 w-14 text-right flex-shrink-0">
                        {h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`}
                      </span>
                      <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                        <div className={`h-4 rounded transition-all ${HOUR_COLOR(pct)}`} style={{ width: `${pct}%` }}/>
                      </div>
                      <span className="text-[10px] text-gray-400 w-5 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top Purposes */}
            <div className="glass rounded-2xl p-5 shadow-sm">
              <h3 className="font-display font-semibold text-gray-700 text-sm mb-4">Top Purposes</h3>
              <div className="space-y-2">
                {purposes.length === 0
                  ? <p className="text-xs text-gray-300 text-center py-8">No data</p>
                  : purposes.slice(0, 8).map((p, i) => {
                      const maxP = purposes[0]?.count || 1
                      const COLORS = ['bg-[var(--dict-blue)]','bg-blue-500','bg-blue-400','bg-blue-300','bg-indigo-400','bg-indigo-300','bg-slate-400','bg-slate-300']
                      return (
                        <div key={p.purpose}>
                          <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                            <span className="truncate max-w-[72%] font-medium">{p.purpose}</span>
                            <span className="font-bold text-gray-700">{p.count}</span>
                          </div>
                          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-2.5 rounded-full ${COLORS[i] || 'bg-gray-400'}`} style={{ width: `${(p.count / maxP) * 100}%` }}/>
                          </div>
                        </div>
                      )
                    })
                }
              </div>
            </div>

            {/* Right column: Agencies + Satisfaction + Duration */}
            <div className="space-y-4">
              {/* Top Agencies */}
              <div className="glass rounded-2xl p-5 shadow-sm">
                <h3 className="font-display font-semibold text-gray-700 text-sm mb-3">Top Agencies / Organizations</h3>
                <div className="space-y-1.5">
                  {agencies.length === 0
                    ? <p className="text-xs text-gray-300 text-center py-4">No data</p>
                    : agencies.slice(0, 6).map((a, i) => {
                        const maxA = agencies[0]?.count || 1
                        return (
                          <div key={a.agency} className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400 w-4">{i + 1}</span>
                            <span className="text-[11px] text-gray-600 flex-1 truncate">{a.agency}</span>
                            <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-2 bg-teal-400 rounded-full" style={{ width: `${(a.count / maxA) * 100}%` }}/>
                            </div>
                            <span className="text-[10px] font-bold text-gray-500 w-5 text-right">{a.count}</span>
                          </div>
                        )
                      })
                  }
                </div>
              </div>

              {/* Session Duration Histogram */}
              {durBuckets.length > 0 && (
                <div className="glass rounded-2xl p-5 shadow-sm">
                  <h3 className="font-display font-semibold text-gray-700 text-sm mb-3">Session Duration</h3>
                  <div className="flex items-end gap-2 h-20">
                    {durBuckets.map(b => {
                      const pct = Math.max(8, (b.count / maxDur) * 100)
                      return (
                        <div key={b.bucket} className="flex-1 flex flex-col items-center gap-0.5 group">
                          <span className="text-[9px] text-gray-400">{b.count}</span>
                          <div className="w-full rounded-t bg-violet-400 hover:bg-violet-500 transition-colors"
                            style={{ height: `${pct}%` }} title={`${b.bucket}: ${b.count}`}/>
                          <span className="text-[8px] text-gray-400 text-center leading-tight">{b.bucket}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Satisfaction Distribution */}
              {ratingDist.length > 0 && (
                <div className="glass rounded-2xl p-5 shadow-sm">
                  <h3 className="font-display font-semibold text-gray-700 text-sm mb-3">Satisfaction</h3>
                  <div className="space-y-1.5">
                    {[5, 4, 3, 2, 1].map(star => {
                      const entry = ratingDist.find(r => r.rating === star)
                      const count = entry?.count ?? 0
                      const total = ratingDist.reduce((a, r) => a + r.count, 0) || 1
                      const pct   = Math.round((count / total) * 100)
                      return (
                        <div key={star} className="flex items-center gap-2">
                          <span className="text-[11px] w-16 flex-shrink-0">{'★'.repeat(star)}<span className="text-gray-300">{'★'.repeat(5 - star)}</span></span>
                          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-3 rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: ['#fbbf24','#f59e0b','#d97706','#b45309','#92400e'][5 - star] }}/>
                          </div>
                          <span className="text-[10px] text-gray-500 w-6 text-right">{count}</span>
                        </div>
                      )
                    })}
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

// ── Audit Trail ────────────────────────────────────────────────────────────────
function AuditTrail() {
  type AuditEntry = {
    id: string; action: string; target: string | null; detail: string | null
    ip: string | null; createdAt: string
    admin?: { username: string; name: string } | null
  }
  type AuditResponse = {
    logs: AuditEntry[]; totalCount: number; todayCount: number
    actionFreq: Record<string, number>
  }

  const [result, setResult]       = useState<AuditResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [actionFilter, setAction] = useState('')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [expanded, setExpanded]   = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const q = new URLSearchParams({ limit: '1000' })
    if (actionFilter) q.set('action', actionFilter)
    if (dateFrom)     q.set('from', dateFrom)
    if (dateTo)       q.set('to', dateTo)
    if (search)       q.set('search', search)
    fetch(`/api/admin-logs?${q}`)
      .then(r => r.json())
      .then(d => { setResult(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [actionFilter, dateFrom, dateTo, search])

  useEffect(() => { load() }, [load])

  const ACTION_META: Record<string, { color: string; icon: string; label: string }> = {
    LOGIN:               { color: 'bg-blue-100 text-blue-700',    icon: '🔑', label: 'Login'          },
    LOGOUT:              { color: 'bg-gray-100 text-gray-600',    icon: '🚪', label: 'Logout'         },
    CREATE_LOG:          { color: 'bg-green-100 text-green-700',  icon: '✅', label: 'New Entry'       },
    CHECKOUT:            { color: 'bg-teal-100 text-teal-700',    icon: '🏁', label: 'Check Out'       },
    AUTO_CHECKOUT:       { color: 'bg-amber-100 text-amber-700',  icon: '⏰', label: 'Auto Check-Out'  },
    EDIT_LOG:            { color: 'bg-yellow-100 text-yellow-700',icon: '✏️', label: 'Edit Entry'      },
    ARCHIVE_LOG:         { color: 'bg-red-100 text-red-600',      icon: '🗃', label: 'Archive'         },
    CHANGE_SETTING:      { color: 'bg-purple-100 text-purple-700',icon: '⚙️', label: 'Setting Changed' },
    CREATE_PC:           { color: 'bg-indigo-100 text-indigo-700',icon: '🖥️', label: 'PC Created'      },
    EDIT_PC:             { color: 'bg-indigo-100 text-indigo-700',icon: '🖊️', label: 'PC Edited'       },
    DELETE_PC:           { color: 'bg-red-100 text-red-600',      icon: '🗑️', label: 'PC Deleted'      },
    CREATE_ANNOUNCEMENT: { color: 'bg-cyan-100 text-cyan-700',    icon: '📢', label: 'Announcement'    },
    CREATE_CAMERA:       { color: 'bg-pink-100 text-pink-700',    icon: '📷', label: 'Camera Added'    },
    DELETE_CAMERA:       { color: 'bg-red-100 text-red-600',      icon: '🗑️', label: 'Camera Removed'  },
  }

  const logs = result?.logs || []
  const freq = result?.actionFreq || {}
  const allActions = Object.keys(freq).sort((a, b) => freq[b] - freq[a])

  const exportCsv = () => {
    const rows = [['Time', 'Action', 'Admin', 'Target', 'Detail', 'IP']]
    logs.forEach(l => {
      let det = l.detail || ''
      try { const d = JSON.parse(det); det = Object.entries(d).map(([k, v]) => `${k}: ${v}`).join('; ') } catch {}
      rows.push([
        new Date(l.createdAt).toLocaleString('en-PH'),
        l.action, l.admin?.name || '—', l.target || '—', det, l.ip || '—',
      ])
    })
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a   = document.createElement('a')
    a.href    = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `audit_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Events',    value: result?.totalCount ?? 0,  icon: '📋', color: 'text-[var(--dict-blue)]', bg: 'bg-blue-50'  },
          { label: 'Today',           value: result?.todayCount ?? 0,  icon: '📅', color: 'text-green-600',          bg: 'bg-green-50' },
          { label: 'Action Types',    value: allActions.length,         icon: '🎯', color: 'text-purple-600',         bg: 'bg-purple-50'},
          { label: 'Loaded',          value: logs.length,              icon: '👁️', color: 'text-amber-600',          bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className={`glass rounded-2xl p-4 shadow-sm ${s.bg}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{s.icon}</span>
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{s.label}</span>
            </div>
            <div className={`text-2xl font-bold font-display ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Action frequency chips */}
      {allActions.length > 0 && (
        <div className="glass rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Action Frequency</p>
          <div className="flex flex-wrap gap-2">
            {allActions.map(a => {
              const meta = ACTION_META[a]
              const isActive = actionFilter === a
              return (
                <button key={a} onClick={() => setAction(isActive ? '' : a)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                    isActive
                      ? 'ring-2 ring-offset-1 ring-[var(--dict-blue)] scale-105 ' + (meta?.color || 'bg-gray-100 text-gray-600')
                      : (meta?.color || 'bg-gray-100 text-gray-600') + ' border-transparent hover:scale-105'
                  }`}>
                  {meta?.icon || '📌'} {meta?.label || a.replace(/_/g, ' ')}
                  <span className="bg-white/60 rounded-full px-1.5 text-[10px] font-bold">{freq[a]}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Search action, detail, IP…"
            className="sm:col-span-2 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-[var(--dict-blue)]"/>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--dict-blue)]"
            title="From date"/>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--dict-blue)]"
            title="To date"/>
        </div>
        <div className="flex items-center gap-2 mt-3">
          {(search || actionFilter || dateFrom || dateTo) && (
            <button onClick={() => { setSearch(''); setAction(''); setDateFrom(''); setDateTo('') }}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
              ✕ Clear filters
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={exportCsv}
              className="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-semibold">
              ⬇ Export CSV
            </button>
            <button onClick={load}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="glass rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-display font-semibold text-gray-700 text-sm">Admin Activity Timeline</h3>
          <p className="text-[10px] text-gray-400">Logged for RA 10173 (Data Privacy Act) compliance</p>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-[var(--dict-blue)] border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
            <p className="text-sm text-gray-300">Loading audit trail…</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-sm text-gray-400">No activity matches your filters</p>
          </div>
        ) : (
          <div className="max-h-[580px] overflow-y-auto divide-y divide-gray-50">
            {logs.map((log, idx) => {
              const meta = ACTION_META[log.action]
              const isExp = expanded === log.id
              let detail = log.detail || ''
              let detailParsed: Record<string, unknown> = {}
              try { detailParsed = JSON.parse(detail); detail = Object.entries(detailParsed).map(([k, v]) => `${k}: ${v}`).join(' · ') } catch {}
              const prevLog = logs[idx - 1]
              const showDate = idx === 0 || new Date(log.createdAt).toDateString() !== new Date(prevLog.createdAt).toDateString()
              return (
                <div key={log.id}>
                  {showDate && (
                    <div className="px-5 py-2 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest sticky top-0 z-10">
                      {new Date(log.createdAt).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                  <button
                    onClick={() => setExpanded(isExp ? null : log.id)}
                    className="w-full flex items-start gap-3 px-5 py-3 hover:bg-gray-50/80 transition-colors text-left">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center gap-0.5 flex-shrink-0 mt-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${meta?.color || 'bg-gray-100 text-gray-500'}`}>
                        {meta?.icon || '📌'}
                      </div>
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-gray-700">{meta?.label || log.action.replace(/_/g, ' ')}</span>
                          {log.admin && (
                            <span className="ml-2 text-[10px] text-gray-400">by <strong className="text-gray-600">{log.admin.name}</strong></span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0 font-mono">
                          {new Date(log.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      {detail && (
                        <p className="text-[11px] text-gray-500 mt-0.5 truncate">{detail}</p>
                      )}
                      {isExp && (
                        <div className="mt-2 bg-gray-50 rounded-xl p-3 space-y-1 text-left border border-gray-100">
                          {log.target && (
                            <div className="flex gap-2 text-[11px]">
                              <span className="text-gray-400 w-16 flex-shrink-0">Target</span>
                              <span className="font-mono text-gray-600 break-all">{log.target}</span>
                            </div>
                          )}
                          {log.ip && (
                            <div className="flex gap-2 text-[11px]">
                              <span className="text-gray-400 w-16 flex-shrink-0">IP</span>
                              <span className="font-mono text-gray-600">{log.ip}</span>
                            </div>
                          )}
                          {Object.entries(detailParsed).map(([k, v]) => (
                            <div key={k} className="flex gap-2 text-[11px]">
                              <span className="text-gray-400 w-16 flex-shrink-0 capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                              <span className="text-gray-600 break-all">{String(v)}</span>
                            </div>
                          ))}
                          <div className="flex gap-2 text-[11px]">
                            <span className="text-gray-400 w-16 flex-shrink-0">Event ID</span>
                            <span className="font-mono text-gray-300 text-[9px]">{log.id}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="text-gray-300 text-xs flex-shrink-0 mt-1">{isExp ? '▲' : '▼'}</span>
                  </button>
                </div>
              )
            })}
          </div>
        )}
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
