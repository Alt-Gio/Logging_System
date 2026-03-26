'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function SetupForm() {
  const router  = useRouter()
  const params  = useSearchParams()
  const token   = params.get('token') || ''

  const [step, setStep]         = useState<'form' | 'done'>('form')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [info, setInfo]         = useState<{ email: string; name: string } | null>(null)

  useEffect(() => {
    if (!token) return
    fetch(`/api/supervisor-auth/invite?token=${token}`)
      .then(r => r.json())
      .then(d => { if (d.email) setInfo({ email: d.email, name: d.name || '' }) })
      .catch(() => {})
  }, [token])

  if (!token) return <p className="text-red-500 text-center">Invalid invite link.</p>

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/supervisor-auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Setup failed'); return }
      setStep('done')
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none text-sm bg-white transition-colors'
  const btnCls   = 'w-full py-3 rounded-xl font-bold text-white text-sm bg-indigo-700 hover:bg-indigo-800 transition-all disabled:opacity-50'

  return (
    <div>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">⚠ {error}</div>}
      {step === 'form' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {info && (
            <div className="bg-indigo-50 rounded-xl p-3 text-sm mb-2">
              <p className="text-gray-500 text-xs">Setting up account for</p>
              <p className="font-semibold text-gray-800">{info.name}</p>
              <p className="text-indigo-700">{info.email}</p>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" className={inputCls} required autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Confirm Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" className={inputCls} required />
          </div>
          <button type="submit" disabled={loading} className={btnCls}>
            {loading ? 'Setting up…' : 'Create Account →'}
          </button>
        </form>
      )}
      {step === 'done' && (
        <div className="text-center py-4 space-y-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-4xl">✅</span>
          </div>
          <h3 className="text-xl font-bold text-gray-800">Account Ready!</h3>
          <p className="text-sm text-gray-500">Your supervisor account is set up. Sign in to start managing your interns.</p>
          <button onClick={() => router.push('/supervisor/login')} className={btnCls}>
            Go to Login →
          </button>
        </div>
      )}
    </div>
  )
}

export default function SupervisorSetupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #312e81 0%, #1e1b4b 50%, #0f0e2a 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white/10 backdrop-blur rounded-3xl flex items-center justify-center mx-auto mb-4 border border-white/20">
            <span className="text-4xl">🔑</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Set Up Your Account</h1>
          <p className="text-indigo-300 text-sm mt-1">DICT DTC Supervisor Portal</p>
        </div>
        <div className="bg-white rounded-3xl shadow-2xl p-7">
          <Suspense fallback={<div className="text-center py-8 text-gray-400">Loading…</div>}>
            <SetupForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
