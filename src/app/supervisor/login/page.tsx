'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function SupervisorLoginContent() {
  const router      = useRouter()
  const params      = useSearchParams()
  const callbackUrl = params.get('callbackUrl') || '/supervisor/dashboard'

  type Step = 'email' | 'otp'
  const [step,    setStep]    = useState<Step>('email')
  const [email,   setEmail]   = useState('')
  const [code,    setCode]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [resent,  setResent]  = useState(false)

  const inputCls = 'w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none text-sm bg-white transition-colors'

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true); setResent(false)
    try {
      const res  = await fetch('/api/supervisor-auth/otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email: email.toLowerCase().trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to send code'); return }
      setStep('otp')
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res  = await fetch('/api/supervisor-auth/otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', email: email.toLowerCase().trim(), code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid code'); return }
      router.push(callbackUrl)
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  async function handleResend() {
    setError(''); setResent(false); setLoading(true)
    try {
      const res = await fetch('/api/supervisor-auth/otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email: email.toLowerCase().trim() }),
      })
      if (res.ok) { setCode(''); setResent(true) } else { setError('Could not resend code') }
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #312e81 0%, #1e1b4b 50%, #0f0e2a 100%)' }}>
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white/10 backdrop-blur rounded-3xl flex items-center justify-center mx-auto mb-4 border border-white/20">
            <span className="text-4xl">🏛️</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Supervisor Portal</h1>
          <p className="text-indigo-300 text-sm mt-1">DICT DTC Region V — Practicum Coordinator</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-7">

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            <div className={`flex-1 flex items-center gap-2`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 'email' ? 'bg-indigo-600 text-white' : 'bg-green-500 text-white'}`}>
                {step === 'email' ? '1' : '✓'}
              </div>
              <span className={`text-xs font-semibold ${step === 'email' ? 'text-indigo-600' : 'text-gray-400'}`}>Email</span>
            </div>
            <div className={`h-px flex-1 ${step === 'otp' ? 'bg-indigo-300' : 'bg-gray-200'}`}/>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 'otp' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400'}`}>2</div>
              <span className={`text-xs font-semibold ${step === 'otp' ? 'text-indigo-600' : 'text-gray-400'}`}>Verify</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
              <span>⚠</span>{error}
            </div>
          )}
          {resent && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2">
              <span>✅</span> New code sent to {email}
            </div>
          )}

          {step === 'email' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">
                  Email Address
                </label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                  placeholder="your@email.com" className={inputCls} required autoFocus/>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-700 leading-relaxed">
                We will send a <strong>6-digit one-time code</strong> to your email address. No password needed.
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-md transition-all">
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Sending code…</>
                  : '📧 Send Login Code'
                }
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-sm text-gray-600">Code sent to</p>
                <p className="font-bold text-gray-800">{email}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">
                  6-Digit Code
                </label>
                <input
                  type="text" inputMode="numeric" value={code}
                  onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                  placeholder="000000" maxLength={6} required autoFocus
                  className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none text-center text-3xl font-black tracking-[0.5em] text-indigo-800 bg-indigo-50 transition-colors"/>
                <p className="text-xs text-gray-400 text-center mt-1.5">Check your inbox — valid for 10 minutes</p>
              </div>
              <button type="submit" disabled={loading || code.length !== 6}
                className="w-full py-3.5 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-md transition-all">
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Verifying…</>
                  : '🔓 Sign In'
                }
              </button>
              <div className="flex items-center justify-between pt-1">
                <button type="button" onClick={()=>{setStep('email');setCode('');setError('')}}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors">← Change email</button>
                <button type="button" onClick={handleResend} disabled={loading}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors disabled:opacity-40">
                  Resend code
                </button>
              </div>
            </form>
          )}

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
