'use client'
import { useState } from 'react'

type FormState = {
  setupToken: string
  username:   string
  password:   string
  confirmPw:  string
  name:       string
  role:       'SUPER_ADMIN' | 'ADMIN' | 'STAFF'
}

export default function SetupPage() {
  const [form, setForm] = useState<FormState>({
    setupToken: '',
    username:   '',
    password:   '',
    confirmPw:  '',
    name:       '',
    role:       'SUPER_ADMIN',
  })
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<{ ok: boolean; message: string } | null>(null)

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setResult(null)
    if (form.password !== form.confirmPw) {
      setResult({ ok: false, message: 'Passwords do not match.' })
      return
    }
    setLoading(true)
    try {
      const res  = await fetch('/api/setup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-setup-token': form.setupToken },
        body:    JSON.stringify({ username: form.username, password: form.password, name: form.name, role: form.role }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, message: `✅ Admin "${data.username}" (${data.role}) created / updated successfully. You can now sign in.` })
        setForm(f => ({ ...f, password: '', confirmPw: '' }))
      } else {
        setResult({ ok: false, message: data.error ?? 'Setup failed.' })
      }
    } catch {
      setResult({ ok: false, message: 'Network error. Is the server running?' })
    }
    setLoading(false)
  }

  const field = (label: string, key: keyof FormState, type = 'text', placeholder = '') => (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>
        {label}
      </label>
      <input
        type={type} value={form[key] as string}
        onChange={set(key)} required placeholder={placeholder}
        style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '11px', border: '1.5px solid rgba(0,0,0,0.10)', fontSize: '14px', fontFamily: 'inherit', background: '#fff', outline: 'none', color: '#0f172a' }}
        onFocus={e => e.currentTarget.style.borderColor = '#0038a8'}
        onBlur={e  => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.10)'}
      />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'Plus Jakarta Sans', sans-serif", position: 'relative', zIndex: 1 }}>

      <div style={{ width: '100%', maxWidth: '440px' }}>

        {/* Header card */}
        <div style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.75)', borderRadius: '20px', boxShadow: '0 8px 40px rgba(0,56,168,0.10)', overflow: 'hidden', marginBottom: '14px' }}>
          <div style={{ display: 'flex', height: '5px' }}>
            <div style={{ flex: 1, background: '#0038A8' }}/><div style={{ flex: 1, background: '#CE1126' }}/><div style={{ flex: 1, background: '#FCD116' }}/>
          </div>
          <div style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '13px', background: 'linear-gradient(135deg,#001f6b,#0038a8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>⚙️</div>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 800, color: '#0038a8', margin: 0 }}>Admin Account Setup</p>
                <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>DICT Region V · DTC Logbook</p>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              Use this page to <strong>create or reset</strong> an admin account. Requires the <code style={{ background: 'rgba(0,56,168,0.07)', padding: '1px 5px', borderRadius: '5px', fontSize: '12px' }}>SETUP_TOKEN</code> from your server&apos;s <code style={{ background: 'rgba(0,56,168,0.07)', padding: '1px 5px', borderRadius: '5px', fontSize: '12px' }}>.env</code> file.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ background: 'rgba(255,255,255,0.90)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.75)', borderRadius: '20px', boxShadow: '0 8px 40px rgba(0,56,168,0.10)', padding: '28px' }}>

          {/* Setup token */}
          <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.20)', borderRadius: '12px', padding: '14px 16px', marginBottom: '22px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>🔑 Setup Token</p>
            <input
              type="password" value={form.setupToken} onChange={set('setupToken')}
              required placeholder="Paste SETUP_TOKEN from server .env"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: '9px', border: '1.5px solid rgba(245,158,11,0.25)', fontSize: '13px', fontFamily: 'inherit', background: '#fff', outline: 'none', color: '#0f172a' }}
              onFocus={e => e.currentTarget.style.borderColor = '#d97706'}
              onBlur={e  => e.currentTarget.style.borderColor = 'rgba(245,158,11,0.25)'}
            />
          </div>

          {field('Username', 'username', 'text', 'e.g. admin')}
          {field('Full Name', 'name', 'text', 'e.g. Juan dela Cruz')}

          {/* Role */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>Role</label>
            <select value={form.role} onChange={set('role')}
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '11px', border: '1.5px solid rgba(0,0,0,0.10)', fontSize: '14px', fontFamily: 'inherit', background: '#fff', outline: 'none', color: '#0f172a', appearance: 'none' }}>
              <option value="SUPER_ADMIN">Super Admin — Full access</option>
              <option value="ADMIN">Admin — Standard access</option>
              <option value="STAFF">Staff — Limited access</option>
            </select>
          </div>

          {field('Password', 'password', 'password', 'Min. 8 characters')}
          {field('Confirm Password', 'confirmPw', 'password', 'Re-enter password')}

          {result && (
            <div style={{
              marginBottom: '16px', padding: '12px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 500,
              background: result.ok ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
              border:     `1px solid ${result.ok ? 'rgba(16,185,129,0.20)' : 'rgba(239,68,68,0.20)'}`,
              color:      result.ok ? '#047857' : '#dc2626',
              lineHeight: 1.55,
            }}>
              {result.message}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '13px', borderRadius: '13px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px', fontWeight: 800, background: 'linear-gradient(135deg,#0038a8,#0050d0)', color: '#fff', boxShadow: '0 4px 18px rgba(0,56,168,0.28)', opacity: loading ? 0.6 : 1, transition: 'all 0.2s' }}>
            {loading ? '⏳ Processing…' : '⚙️ Create / Update Admin Account'}
          </button>

          {result?.ok && (
            <a href="/sign-in" style={{ display: 'block', textAlign: 'center', marginTop: '14px', padding: '12px', borderRadius: '13px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.20)', color: '#047857', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>
              → Go to Sign In
            </a>
          )}
        </form>

        <p style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', marginTop: '16px' }}>
          Remove <code>SETUP_TOKEN</code> from your <code>.env</code> after setup to disable this page.
        </p>
      </div>
    </div>
  )
}
