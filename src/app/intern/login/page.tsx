'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Step = 'email' | 'otp' | 'password'

export default function InternLoginPage() {
  const router      = useRouter()
  const params      = useSearchParams()
  const callbackUrl = params.get('callbackUrl') || '/intern/dashboard'

  const [step, setStep]           = useState<Step>('email')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [otp, setOtp]             = useState('')
  const [useOtp, setUseOtp]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim()) return
    if (useOtp) {
      setLoading(true)
      try {
        const res = await fetch('/api/otp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contact: email.toLowerCase().trim(), contactType: 'email', purpose: 'intern_login', name: 'Intern' }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Failed to send OTP'); return }
        setStep('otp')
        setCountdown(60)
      } catch { setError('Network error') } finally { setLoading(false) }
    } else {
      setStep('password')
    }
  }

  async function handleResendOtp() {
    if (countdown > 0) return
    setLoading(true)
    try {
      await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: email.toLowerCase().trim(), contactType: 'email', purpose: 'intern_login', name: 'Intern' }),
      })
      setCountdown(60)
    } finally { setLoading(false) }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body: Record<string, string> = { email: email.toLowerCase().trim() }
      if (useOtp) body.otpCode = otp
      else body.password = password
      const res  = await fetch('/api/intern-auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login failed'); return }
      router.push(callbackUrl)
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-sm bg-white transition-colors'
  const btnCls   = 'w-full py-3 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50'

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0038A8 0%, #003580 40%, #001f5c 100%)' }}>
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white/10 backdrop-blur rounded-3xl flex items-center justify-center mx-auto mb-4 border border-white/20">
            <span className="text-4xl">🎓</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Intern Portal</h1>
          <p className="text-blue-200 text-sm mt-1">DICT DTC Region V — Gamified OJT</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-7">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              ⚠ {error}
            </div>
          )}

          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your.email@example.com" className={inputCls} required autoFocus />
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setUseOtp(v => !v)}
                  className={`w-10 h-6 rounded-full transition-colors flex items-center ${useOtp ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${useOtp ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-sm text-gray-600">Sign in with OTP instead</span>
              </label>
              <button type="submit" disabled={loading} className={`${btnCls} bg-[#0038A8] hover:bg-blue-800`}>
                {loading ? 'Please wait…' : (useOtp ? 'Send OTP →' : 'Continue →')}
              </button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <button type="button" onClick={() => setStep('email')} className="text-blue-600 hover:text-blue-800 text-sm">← Back</button>
                <span className="text-sm text-gray-500 truncate">{email}</span>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" className={inputCls} required autoFocus />
              </div>
              <button type="submit" disabled={loading} className={`${btnCls} bg-[#0038A8] hover:bg-blue-800`}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
              <button type="button" onClick={() => { setUseOtp(true); setStep('email') }} className="w-full text-center text-sm text-blue-600 hover:text-blue-800 py-1">
                Forgot password? Use OTP instead
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <button type="button" onClick={() => setStep('email')} className="text-blue-600 text-sm">← Back</button>
              </div>
              <div className="text-center py-2">
                <p className="text-sm text-gray-600">Enter the 6-digit code sent to</p>
                <p className="font-semibold text-gray-800">{email}</p>
              </div>
              <div>
                <input
                  type="text" inputMode="numeric" maxLength={6}
                  value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-center text-3xl font-mono tracking-[1rem] bg-white transition-colors"
                  required autoFocus
                />
              </div>
              <button type="submit" disabled={loading || otp.length < 6} className={`${btnCls} bg-[#0038A8] hover:bg-blue-800`}>
                {loading ? 'Verifying…' : 'Verify & Sign In'}
              </button>
              <button type="button" onClick={handleResendOtp} disabled={countdown > 0 || loading} className="w-full text-center text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 py-1">
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
              </button>
            </form>
          )}

          <p className="text-center text-xs text-gray-400 mt-5">
            Don&apos;t have an account? Check your email for an invite link.
          </p>
        </div>

        <p className="text-center text-blue-200/60 text-xs mt-6">
          Supervisor? <a href="/supervisor/login" className="text-blue-300 underline">Sign in here</a>
        </p>
      </div>
    </div>
  )
}
