'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function SupervisorLoginContent() {
  const router      = useRouter()
  const params      = useSearchParams()
  const callbackUrl = params.get('callbackUrl') || '/supervisor/dashboard'

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res  = await fetch('/api/supervisor-auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.toLowerCase().trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login failed'); return }
      router.push(callbackUrl)
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none text-sm bg-white transition-colors'

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #312e81 0%, #1e1b4b 50%, #0f0e2a 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white/10 backdrop-blur rounded-3xl flex items-center justify-center mx-auto mb-4 border border-white/20">
            <span className="text-4xl">🏛️</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Supervisor Portal</h1>
          <p className="text-indigo-300 text-sm mt-1">DICT DTC Region V</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-7">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              ⚠ {error}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="supervisor@dict.gov.ph" className={inputCls} required autoFocus />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" className={inputCls} required />
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 rounded-xl font-bold text-white text-sm bg-indigo-700 hover:bg-indigo-800 transition-all disabled:opacity-50">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
          <p className="text-center text-xs text-gray-400 mt-5">
            Need access? Contact your DICT DTC administrator.
          </p>
        </div>

        <p className="text-center text-indigo-300/60 text-xs mt-6">
          Intern? <a href="/intern/login" className="text-indigo-300 underline">Sign in here</a>
        </p>
      </div>
    </div>
  )
}

export default function SupervisorLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #312e81, #0f0e2a)' }}>
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <SupervisorLoginContent />
    </Suspense>
  )
}
