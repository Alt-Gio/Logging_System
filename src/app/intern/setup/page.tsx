'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function SetupForm() {
  const router  = useRouter()
  const params  = useSearchParams()
  const token   = params.get('token') || ''

  const [step, setStep]         = useState<'form' | 'otp' | 'done'>('form')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [otp, setOtp]           = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [email, setEmail]       = useState('')
  const [name, setName]         = useState('')
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (!token) return
    fetch(`/api/intern-auth/invite?token=${token}`)
      .then(r => r.json())
      .then(d => { if (d.email) { setEmail(d.email); setName(d.name || '') } })
      .catch(() => {})
  }, [token])

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  if (!token) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Invalid or missing invite link.</p>
        <a href="/intern/login" className="text-blue-600 underline mt-2 block">Go to login</a>
      </div>
    )
  }

  async function handleSendOtp() {
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: email, contactType: 'email', purpose: 'intern_verify', name: name || 'Intern' }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to send OTP'); return }
      setStep('otp')
      setCountdown(60)
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/intern-auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, otpCode: otp }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Verification failed'); return }
      setStep('done')
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-sm bg-white transition-colors'
  const btnCls   = 'w-full py-3 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50 bg-[#0038A8] hover:bg-blue-800'

  return (
    <div>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">⚠ {error}</div>}

      {step === 'form' && (
        <div className="space-y-4">
          {email && (
            <div className="bg-blue-50 rounded-xl p-3 text-sm">
              <p className="text-gray-500 text-xs">Registering as</p>
              <p className="font-semibold text-gray-800">{name}</p>
              <p className="text-blue-700">{email}</p>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Confirm Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" className={inputCls} />
          </div>
          <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3 space-y-1">
            <p className={password.length >= 8 ? 'text-green-600' : ''}>✓ At least 8 characters</p>
            <p className={password === confirm && confirm ? 'text-green-600' : ''}>✓ Passwords match</p>
          </div>
          <button onClick={handleSendOtp} disabled={loading || !email} className={btnCls}>
            {loading ? 'Sending OTP…' : 'Verify Email & Continue →'}
          </button>
        </div>
      )}

      {step === 'otp' && (
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="text-center py-2">
            <p className="text-sm text-gray-600">Enter the 6-digit code sent to</p>
            <p className="font-semibold text-gray-800">{email}</p>
          </div>
          <input
            type="text" inputMode="numeric" maxLength={6}
            value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-center text-3xl font-mono tracking-[1rem] bg-white transition-colors"
            autoFocus required
          />
          <button type="submit" disabled={loading || otp.length < 6} className={btnCls}>
            {loading ? 'Creating account…' : 'Create My Account'}
          </button>
          <button type="button" onClick={() => { setCountdown(0); setStep('form') }} className="w-full text-center text-sm text-gray-400 py-1">
            ← Back
          </button>
          <button type="button" onClick={() => { setStep('form'); setTimeout(handleSendOtp, 100) }} disabled={countdown > 0} className="w-full text-center text-sm text-blue-600 disabled:text-gray-400 py-1">
            {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="text-center py-4 space-y-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-4xl">🎉</span>
          </div>
          <h3 className="text-xl font-bold text-gray-800">Account Created!</h3>
          <p className="text-sm text-gray-500">Your DICT DTC intern account is ready. Start your OJT journey!</p>
          <button onClick={() => router.push('/intern/login')} className={btnCls}>
            Go to Login →
          </button>
        </div>
      )}
    </div>
  )
}

export default function InternSetupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0038A8 0%, #003580 40%, #001f5c 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white/10 backdrop-blur rounded-3xl flex items-center justify-center mx-auto mb-4 border border-white/20">
            <span className="text-4xl">✨</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Create Your Account</h1>
          <p className="text-blue-200 text-sm mt-1">DICT DTC Intern Portal</p>
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
