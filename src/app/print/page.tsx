// src/app/print/page.tsx — print-friendly daily log
// Access: /print?date=2026-03-05&secret=CRON_SECRET
'use client'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'

type Log = {
  id: string; fullName: string; agency: string; purpose: string
  equipmentUsed: string[]; timeIn: string; timeOut: string | null
  plannedDurationHours: number; pc?: { name: string } | null
}

export default function PrintPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [date, setDate] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const d = params.get('date') || format(new Date(), 'yyyy-MM-dd')
    setDate(d)
    // Note: non-admin fetches get PII-stripped data (no fullName/agency)
    // Admins who open this page directly while authenticated get full data
    fetch(`/api/logs?date=${d}&limit=500`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setLogs(Array.isArray(data) ? data : []); setLoading(false) })
  }, [])

  const totalMinutes = (log: Log) => {
    if (!log.timeOut) return null
    return Math.round((new Date(log.timeOut).getTime() - new Date(log.timeIn).getTime()) / 60000)
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11px; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
      `}</style>

      <div style={{ padding: '20px', maxWidth: '1100px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '16px', borderBottom: '2px solid #003082', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', alignItems: 'center', marginBottom: '6px' }}>
            <img src="/dict-seal.png" alt="DICT" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '50%' }} onError={e => { (e.target as HTMLImageElement).style.display='none' }}/>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#003082' }}>Republic of the Philippines</div>
              <div style={{ fontSize: '14px', color: '#003082' }}>Department of Information and Communications Technology</div>
              <div style={{ fontSize: '13px', color: '#555' }}>Regional Office V — Digital Transformation Center</div>
            </div>
          </div>
          <div style={{ fontSize: '15px', fontWeight: 'bold', marginTop: '6px' }}>
            CLIENT LOGBOOK — Daily Record of Service
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
            Date: <strong>{date ? format(new Date(date + 'T00:00:00'), 'MMMM d, yyyy (EEEE)') : ''}</strong>
            &nbsp;·&nbsp; Total entries: <strong>{logs.length}</strong>
            &nbsp;·&nbsp; Active: <strong>{logs.filter(l => !l.timeOut).length}</strong>
          </div>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ backgroundColor: '#003082', color: 'white' }}>
              {['#','Full Name','Agency / School','Purpose','Equipment','Time In','Time Out','Duration','Workstation','Remarks'].map(h => (
                <th key={h} style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => {
              const mins = totalMinutes(log)
              const isActive = !log.timeOut
              return (
                <tr key={log.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f8f9ff' }}>
                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontWeight: '500' }}>{log.fullName}</td>
                  <td style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{log.agency}</td>
                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', maxWidth: '180px' }}>{log.purpose}</td>
                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', whiteSpace: 'nowrap' }}>{log.equipmentUsed.join(', ')}</td>
                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{format(new Date(log.timeIn), 'hh:mm a')}</td>
                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {log.timeOut ? format(new Date(log.timeOut), 'hh:mm a') : <em style={{ color: '#f59e0b' }}>Active</em>}
                  </td>
                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', textAlign: 'center' }}>
                    {mins != null ? `${mins}m` : <em style={{ color: '#f59e0b' }}>—</em>}
                  </td>
                  <td style={{ border: '1px solid #ddd', padding: '5px 8px' }}>{log.pc?.name ?? '—'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '5px 8px', minWidth: '80px' }}>{isActive ? 'Still inside' : ''}</td>
                </tr>
              )
            })}
            {logs.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No entries for this date</td></tr>
            )}
          </tbody>
        </table>

        {/* Summary */}
        <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[
            { label: 'Total Clients', value: logs.length },
            { label: 'Desktop Computer', value: logs.filter(l => l.equipmentUsed.includes('Desktop Computer')).length },
            { label: 'Internet Only', value: logs.filter(l => l.equipmentUsed.includes('Internet Only')).length },
            { label: 'Still Active', value: logs.filter(l => !l.timeOut).length },
          ].map(s => (
            <div key={s.label} style={{ border: '1px solid #003082', borderRadius: '6px', padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#003082' }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: '#666' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Signature block */}
        <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
          {['Prepared by', 'Noted by'].map(label => (
            <div key={label}>
              <div style={{ borderBottom: '1px solid #333', marginBottom: '4px', height: '32px' }}/>
              <div style={{ fontSize: '10px', color: '#555' }}>{label}</div>
              <div style={{ fontSize: '10px', color: '#555' }}>Name &amp; Signature / Date</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '16px', fontSize: '9px', color: '#999', textAlign: 'center' }}>
          Generated by DICT DTC Region V Client Logbook System · {format(new Date(), 'PPpp')} · Data collected pursuant to RA 10173 (Data Privacy Act of 2012)
        </div>
      </div>

      {/* Print controls */}
      <div className="no-print" style={{ position: 'fixed', bottom: '20px', right: '20px', display: 'flex', gap: '8px' }}>
        <input type="date" defaultValue={date} onChange={e => window.location.search = `?date=${e.target.value}`}
          style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' }}/>
        <button onClick={() => window.print()}
          style={{ padding: '8px 20px', background: '#003082', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
          🖨 Print
        </button>
        <button onClick={() => window.close()}
          style={{ padding: '8px 12px', background: '#eee', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
          ✕ Close
        </button>
      </div>
    </>
  )
}
