'use client'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'

type Log = {
  id: string; fullName: string; agency: string; purpose: string
  equipmentUsed: string[]; timeIn: string; timeOut: string | null
  plannedDurationHours: number; pc?: { name: string } | null
}

export default function PrintPage() {
  const [logs, setLogs]       = useState<Log[]>([])
  const [date, setDate]       = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const d = params.get('date') || format(new Date(), 'yyyy-MM-dd')
    setDate(d)
    fetch(`/api/logs?date=${d}&limit=500`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setLogs(Array.isArray(data) ? data : []); setLoading(false) })
  }, [])

  const durMinutes = (log: Log) => {
    if (!log.timeOut) return null
    return Math.round((new Date(log.timeOut).getTime() - new Date(log.timeIn).getTime()) / 60000)
  }
  const fmtDur = (m: number | null) => {
    if (m === null) return '—'
    if (m < 60) return `${m}m`
    return `${Math.floor(m/60)}h ${m%60}m`
  }

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#64748b',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #0038a8', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }}/>
        <p>Loading logbook…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const active   = logs.filter(l => !l.timeOut).length
  const dateLabel = date ? format(new Date(date + 'T00:00:00'), 'MMMM d, yyyy (EEEE)') : ''

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Plus Jakarta Sans', Arial, sans-serif;
          background: #fff;
          color: #0f172a;
        }
        /* Override the global Bg.png for print page */
        body::before { display: none !important; }
        body { background-image: none !important; background-color: #fff !important; }

        @media print {
          .no-print { display: none !important; }
          body { font-size: 10px; }
          .page-header { position: relative !important; }
          table { page-break-inside: auto; }
          tr    { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
        }
      `}</style>

      {/* Screen-only controls */}
      <div className="no-print" style={{
        position: 'sticky', top: 0, zIndex: 10, background: '#0038a8',
        padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 12px rgba(0,56,168,0.30)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/dict-seal.png" alt="" style={{ width: '32px', height: '32px', objectFit: 'contain' }}/>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>
            Print Preview · {dateLabel}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <a href="/admin" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Admin
          </a>
          <button onClick={() => window.print()} style={{
            padding: '8px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            background: '#fff', color: '#0038a8', fontWeight: 800, fontSize: '13px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}>
            🖨 Print / Export PDF
          </button>
        </div>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: '1200px', margin: '0 auto' }}>

        {/* Document header */}
        <div style={{ textAlign: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '3px solid #0038a8' }}>
          {/* Logos + title */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '10px' }}>
            <img src="/dict-seal.png" alt="DICT" style={{ width: '56px', height: '56px', objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display='none' }}/>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>
                Republic of the Philippines
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0038a8', lineHeight: 1.15 }}>
                Department of Information and Communications Technology
              </div>
              <div style={{ fontSize: '13px', color: '#475569', marginTop: '2px' }}>
                Regional Office V — Digital Transformation Center · Legazpi City, Albay
              </div>
            </div>
            <img src="/bagong-pilipinas.png" alt="" style={{ width: '56px', height: '56px', objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display='none' }}/>
          </div>

          {/* Report title */}
          <div style={{ background: '#0038a8', color: '#fff', borderRadius: '10px', padding: '10px 24px', display: 'inline-block', marginTop: '8px' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.04em' }}>
              CLIENT LOGBOOK — Daily Record of Service
            </div>
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '28px', marginTop: '12px', flexWrap: 'wrap' }}>
            {[
              { label: 'Date',            value: dateLabel },
              { label: 'Total Entries',   value: logs.length.toString() },
              { label: 'Active Sessions', value: active.toString() },
              { label: 'Completed',       value: (logs.length - active).toString() },
            ].map(m => (
              <div key={m.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0038a8' }}>{m.value}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
            <p style={{ fontSize: '16px', fontWeight: 600 }}>No entries for {dateLabel}</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #001f6b, #0038a8)' }}>
                {['#', 'Full Name', 'Agency / School', 'Purpose', 'Equipment', 'Time In', 'Time Out', 'Duration', 'Workstation', 'Status'].map(h => (
                  <th key={h} style={{
                    border: '1px solid rgba(255,255,255,0.15)', padding: '9px 10px',
                    color: '#fff', fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap',
                    fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => {
                const mins    = durMinutes(log)
                const isActive = !log.timeOut
                return (
                  <tr key={log.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8faff' }}>
                    <td style={{ border: '1px solid #e2e8f0', padding: '8px 10px', fontWeight: 700, color: '#94a3b8', width: '32px' }}>{i + 1}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: '8px 10px', fontWeight: 700, color: '#0f172a' }}>{log.fullName || '—'}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: '8px 10px', color: '#475569' }}>{log.agency || '—'}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: '8px 10px', color: '#475569', maxWidth: '160px' }}>{log.purpose}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: '8px 10px', color: '#475569' }}>{log.equipmentUsed.join(', ')}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: '8px 10px', whiteSpace: 'nowrap', color: '#0f172a', fontWeight: 500 }}>
                      {format(new Date(log.timeIn), 'hh:mm a')}
                    </td>
                    <td style={{ border: '1px solid #e2e8f0', padding: '8px 10px', whiteSpace: 'nowrap', color: isActive ? '#f59e0b' : '#0f172a' }}>
                      {log.timeOut ? format(new Date(log.timeOut), 'hh:mm a') : '—'}
                    </td>
                    <td style={{ border: '1px solid #e2e8f0', padding: '8px 10px', whiteSpace: 'nowrap', fontWeight: 600, color: '#0038a8' }}>
                      {fmtDur(mins)}
                    </td>
                    <td style={{ border: '1px solid #e2e8f0', padding: '8px 10px', color: '#475569' }}>
                      {log.pc?.name ?? '—'}
                    </td>
                    <td style={{ border: '1px solid #e2e8f0', padding: '8px 10px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 800,
                        background: isActive ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.12)',
                        color: isActive ? '#059669' : '#64748b',
                        border: `1px solid ${isActive ? 'rgba(16,185,129,0.25)' : 'rgba(148,163,184,0.25)'}`,
                      }}>
                        {isActive ? 'ACTIVE' : 'DONE'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f1f5f9' }}>
                <td colSpan={10} style={{ border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: '11px', color: '#64748b', textAlign: 'right' }}>
                  <strong style={{ color: '#0038a8' }}>{logs.length} entries</strong> total ·
                  <strong style={{ color: '#059669', marginLeft: '8px' }}> {active} active</strong> ·
                  <strong style={{ color: '#64748b', marginLeft: '8px' }}> {logs.length - active} completed</strong>
                  <span style={{ marginLeft: '24px' }}>Printed: {format(new Date(), 'MMMM d, yyyy hh:mm a')}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        )}

        {/* Signature block */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '48px', paddingTop: '24px', borderTop: '1px solid #e2e8f0' }}>
          {[
            { label: 'Prepared by', name: '______________________________', title: 'DTC Staff' },
            { label: 'Reviewed by', name: '______________________________', title: 'DTC Head / IT Officer' },
            { label: 'Noted by',    name: '______________________________', title: 'Regional Director, DICT V' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', minWidth: '200px' }}>
              <div style={{ height: '40px', borderBottom: '1.5px solid #0038a8', marginBottom: '6px' }}/>
              <p style={{ fontSize: '11px', fontWeight: 800, color: '#0038a8' }}>{s.name}</p>
              <p style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{s.title}</p>
              <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
          <p style={{ fontSize: '10px', color: '#94a3b8' }}>
            DICT Region V · Digital Transformation Center · region5@dict.gov.ph · dict.gov.ph
          </p>
        </div>
      </div>
    </>
  )
}
