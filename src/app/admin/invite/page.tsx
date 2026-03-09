'use client'
import { useState, useEffect } from 'react'
import { useUser, UserButton } from '@clerk/nextjs'

type Invite = {
  id: string
  emailAddress: string | null
  status: 'pending' | 'accepted' | 'revoked'
  createdAt: string
  url?: string
}

const S = {
  page: { minHeight: '100vh', fontFamily: "'Plus Jakarta Sans', sans-serif", position: 'relative' as const, zIndex: 1 },
  header: {
    background: 'linear-gradient(135deg, #001a60 0%, #0038a8 55%, #0050d0 100%)',
    boxShadow: '0 4px 24px rgba(0,56,168,0.30)',
    position: 'sticky' as const, top: 0, zIndex: 20,
  },
  stripe: { display: 'flex', height: '4px' },
  headerInner: { maxWidth: '1000px', margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' },
  card: {
    background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.70)', borderRadius: '20px',
    boxShadow: '0 4px 28px rgba(0,0,0,0.07)',
  },
}

export default function InvitePage() {
  const { user, isLoaded } = useUser()
  const [emails, setEmails]     = useState('')
  const [invites, setInvites]   = useState<Invite[]>([])
  const [loading, setLoading]   = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')
  const [copied, setCopied]     = useState<string | null>(null)
  const [mode, setMode]         = useState<'email' | 'link'>('email')

  useEffect(() => {
    fetch('/api/invitations')
      .then(r => r.json())
      .then(d => { if (d.invitations) setInvites(d.invitations) })
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [])

  async function sendInvites() {
    setError(''); setSuccess('')
    const list = emails.split(/[\n,;]/).map(e => e.trim()).filter(Boolean)
    if (!list.length) return setError('Enter at least one email address')
    const bad = list.filter(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    if (bad.length) return setError(`Invalid: ${bad.join(', ')}`)
    setLoading(true)
    try {
      const r = await fetch('/api/invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emails: list }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed')
      setInvites(p => [...d.invitations, ...p])
      setSuccess(`${d.invitations.length} invitation(s) sent!`)
      setEmails('')
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  async function generateLink() {
    setError(''); setLoading(true)
    try {
      const r = await fetch('/api/invitations/link', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed')
      setInvites(p => [d.invitation, ...p])
      setSuccess('Invite link generated — copy it below.')
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  async function revoke(id: string) {
    await fetch(`/api/invitations/${id}`, { method: 'DELETE' })
    setInvites(p => p.filter(i => i.id !== id))
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopied(id); setTimeout(() => setCopied(null), 2500)
  }

  const stats = {
    pending:  invites.filter(i => i.status === 'pending').length,
    accepted: invites.filter(i => i.status === 'accepted').length,
    revoked:  invites.filter(i => i.status === 'revoked').length,
  }

  return (
    <div style={S.page}>

      {/* Header */}
      <header style={S.header}>
        <div style={S.stripe}>
          <div style={{ flex: 1, background: '#0038A8' }}/>
          <div style={{ flex: 1, background: '#CE1126' }}/>
          <div style={{ flex: 1, background: '#FCD116' }}/>
        </div>
        <div style={S.headerInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <a href="/admin" style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              color: 'rgba(255,255,255,0.65)', fontSize: '13px', textDecoration: 'none', fontWeight: 600,
              padding: '6px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.08)', transition: 'all 0.2s',
            }}>
              ← Admin Panel
            </a>
            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.15)' }}/>
            <div>
              <p style={{ color: '#fff', fontWeight: 800, fontSize: '15px', margin: 0, fontFamily: "'Sora', sans-serif" }}>
                Staff Invite System
              </p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', margin: 0 }}>
                DICT Region V · Access Management
              </p>
            </div>
          </div>
          {isLoaded && user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: 'rgba(255,255,255,0.70)', fontSize: '12px', fontWeight: 500 }}>
                {user.fullName ?? user.username}
              </span>
              <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: 'w-8 h-8' } }}/>
            </div>
          )}
        </div>
      </header>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Page title */}
        <div style={{ marginBottom: '28px', animation: 'fadeInUp 0.4s both' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', marginBottom: '6px', fontFamily: "'Sora', sans-serif" }}>
            Invite Staff Members
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            Only invited accounts can access the DTC admin panel. Manage all staff invitations here.
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
          {([
            { label: 'Pending', value: stats.pending,  color: '#d97706', glow: 'rgba(251,191,36,0.15)', icon: '⏳', bg: 'rgba(251,191,36,0.08)'  },
            { label: 'Accepted', value: stats.accepted, color: '#059669', glow: 'rgba(16,185,129,0.15)', icon: '✅', bg: 'rgba(16,185,129,0.08)'  },
            { label: 'Revoked',  value: stats.revoked,  color: '#dc2626', glow: 'rgba(239,68,68,0.15)',  icon: '🚫', bg: 'rgba(239,68,68,0.08)'   },
          ] as const).map((s, i) => (
            <div key={s.label} style={{
              ...S.card, padding: '20px 24px',
              display: 'flex', alignItems: 'center', gap: '16px',
              animation: `fadeInUp 0.4s ${0.05 * i}s both`,
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                {s.icon}
              </div>
              <div>
                <p style={{ fontSize: '32px', fontWeight: 800, color: s.color, margin: 0, lineHeight: 1, fontFamily: "'Sora', sans-serif" }}>{s.value}</p>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '3px 0 0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '20px', alignItems: 'start' }}>

          {/* Form */}
          <div style={{ ...S.card, padding: '28px', animation: 'fadeInUp 0.4s 0.15s both' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '4px', fontFamily: "'Sora', sans-serif" }}>
              Send Invitation
            </h2>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '22px' }}>
              Invited accounts get access immediately after signing up.
            </p>

            {/* Mode toggle */}
            <div style={{
              display: 'flex', background: 'rgba(0,56,168,0.06)', borderRadius: '14px', padding: '5px', marginBottom: '22px',
              border: '1px solid rgba(0,56,168,0.08)',
            }}>
              {(['email', 'link'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  flex: 1, padding: '9px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: '12px', fontWeight: 700, transition: 'all 0.2s',
                  background: mode === m ? '#0038a8' : 'transparent',
                  color:      mode === m ? '#fff' : '#64748b',
                  boxShadow:  mode === m ? '0 2px 10px rgba(0,56,168,0.25)' : 'none',
                }}>
                  {m === 'email' ? '📧 By Email' : '🔗 Link'}
                </button>
              ))}
            </div>

            {mode === 'email' ? (
              <>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '8px' }}>
                  Email Addresses
                </label>
                <textarea
                  value={emails} onChange={e => setEmails(e.target.value)} rows={5}
                  placeholder={"staff@dict.gov.ph\njuan.delacruz@dict.gov.ph"}
                  style={{
                    width: '100%', borderRadius: '14px', border: '1.5px solid rgba(0,0,0,0.09)',
                    padding: '13px 14px', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace",
                    outline: 'none', resize: 'vertical', lineHeight: 1.65,
                    background: 'rgba(255,255,255,0.75)', color: '#0f172a', boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#0038a8'}
                  onBlur={e  => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.09)'}
                />
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: '6px 0 20px' }}>
                  Separate with commas, semicolons, or new lines
                </p>
              </>
            ) : (
              <div style={{ background: 'rgba(0,56,168,0.04)', borderRadius: '14px', padding: '18px', marginBottom: '20px', border: '1px dashed rgba(0,56,168,0.18)' }}>
                <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.65, margin: 0 }}>
                  Generate a <strong>one-time invite link</strong> valid for 7 days. Anyone with the link can create a staff account and access the admin panel.
                </p>
              </div>
            )}

            <button
              onClick={mode === 'email' ? sendInvites : generateLink}
              disabled={loading || (mode === 'email' && !emails.trim())}
              style={{
                width: '100%', padding: '13px', borderRadius: '14px', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '14px', fontWeight: 800,
                background: 'linear-gradient(135deg, #0038a8, #0050d0)',
                color: '#fff', boxShadow: '0 4px 18px rgba(0,56,168,0.30)',
                opacity: (loading || (mode === 'email' && !emails.trim())) ? 0.5 : 1,
                transition: 'all 0.2s',
              }}>
              {loading ? '⏳ Processing…' : mode === 'email' ? '✉️ Send Invitations' : '🔗 Generate Link'}
            </button>

            {error   && <div style={{ marginTop: '14px', padding: '12px 16px', borderRadius: '12px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626', fontSize: '13px', fontWeight: 500 }}>⚠️ {error}</div>}
            {success && <div style={{ marginTop: '14px', padding: '12px 16px', borderRadius: '12px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', color: '#059669', fontSize: '13px', fontWeight: 500 }}>✅ {success}</div>}
          </div>

          {/* Invite list */}
          <div style={{ ...S.card, padding: '28px', animation: 'fadeInUp 0.4s 0.20s both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0, fontFamily: "'Sora', sans-serif" }}>
                All Invitations
              </h2>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
                {invites.length} total
              </span>
            </div>

            {fetching ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ height: '72px', borderRadius: '14px', background: 'rgba(148,163,184,0.12)', animation: 'pulse 1.5s infinite' }}/>
                ))}
              </div>
            ) : invites.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ fontSize: '44px', marginBottom: '12px' }}>✉️</div>
                <p style={{ color: '#64748b', fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>No invitations yet</p>
                <p style={{ color: '#94a3b8', fontSize: '13px' }}>Send your first invite to get started</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '480px', overflowY: 'auto', paddingRight: '4px' }}>
                {invites.map((inv, idx) => {
                  const statusMap = {
                    pending:  { color: '#d97706', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.25)', label: 'Pending'  },
                    accepted: { color: '#059669', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.25)', label: 'Accepted' },
                    revoked:  { color: '#dc2626', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)',  label: 'Revoked'  },
                  }
                  const sm = statusMap[inv.status] ?? statusMap.pending
                  return (
                    <div key={inv.id} style={{
                      background: 'rgba(248,250,252,0.75)', borderRadius: '14px', padding: '14px 16px',
                      border: '1px solid rgba(226,232,240,0.70)',
                      animation: `fadeInUp 0.3s ${idx * 0.03}s both`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: (inv.url || inv.status === 'pending') ? '10px' : '0' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {inv.emailAddress ?? '🔗 One-time invite link'}
                          </p>
                          <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                            Created {new Date(inv.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <span style={{
                          flexShrink: 0, fontSize: '10px', fontWeight: 800, padding: '3px 9px',
                          borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.06em',
                          background: sm.bg, color: sm.color, border: `1px solid ${sm.border}`,
                        }}>
                          {sm.label}
                        </span>
                      </div>
                      {(inv.url || inv.status === 'pending') && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {inv.url && (
                            <button onClick={() => copy(inv.url!, inv.id)} style={{
                              flex: 1, padding: '7px', borderRadius: '10px', border: '1px solid rgba(0,56,168,0.18)',
                              background: 'rgba(0,56,168,0.05)', color: '#0038a8', fontSize: '12px', fontWeight: 700,
                              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                            }}>
                              {copied === inv.id ? '✅ Copied!' : '📋 Copy Link'}
                            </button>
                          )}
                          {inv.status === 'pending' && (
                            <button onClick={() => revoke(inv.id)} style={{
                              padding: '7px 14px', borderRadius: '10px', border: '1px solid rgba(220,38,38,0.18)',
                              background: 'rgba(220,38,38,0.05)', color: '#dc2626', fontSize: '12px', fontWeight: 700,
                              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                            }}>
                              Revoke
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
