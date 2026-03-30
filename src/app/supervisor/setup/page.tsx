'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function SetupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token  = params.get('token') || ''

  type Step = 'loading' | 'confirm' | 'activating' | 'done' | 'error'
  const [step,    setStep]    = useState<Step>('loading')
  const [info,    setInfo]    = useState<{ email: string; name: string; department?: string } | null>(null)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!token) { setStep('error'); setError('Invalid invite link.'); return }
    fetch(`/api/supervisor-auth/invite?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setStep('error'); return }
        setInfo({ email: d.email, name: d.name || '', department: d.department || '' })
        setStep('confirm')
      })
      .catch(() => { setError('Could not load invite. It may have expired.'); setStep('error') })
  }, [token])

  async function handleActivate() {
    setStep('activating')
    setError('')
    try {
      const res  = await fetch('/api/supervisor-auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Activation failed'); setStep('confirm'); return }
      setStep('done')
      setTimeout(() => router.push('/supervisor/dashboard'), 1500)
    } catch { setError('Network error'); setStep('confirm') }
  }

  if (step === 'loading') return (
    <div className="flex flex-col items-center py-10 gap-3">
      <div className="w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin"/>
      <p className="text-sm text-gray-400">Validating invite…</p>
    </div>
  )

  if (step === 'error') return (
    <div className="text-center py-6 space-y-3">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-3xl">❌</div>
      <p className="font-bold text-gray-800">Invite Error</p>
      <p className="text-sm text-red-600">{error}</p>
      <button onClick={() => router.push('/supervisor/login')}
        className="w-full py-3 rounded-xl font-bold text-white text-sm bg-indigo-700 hover:bg-indigo-800 transition-all mt-2">
        Go to Login
      </button>
    </div>
  )

  if (step === 'done') return (
    <div className="text-center py-6 space-y-4">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-4xl">✅</div>
      <h3 className="text-xl font-bold text-gray-800">Account Activated!</h3>
      <p className="text-sm text-gray-500">Welcome, {info?.name}! Redirecting to your dashboard…</p>
      <div className="flex justify-center">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
          <span>⚠</span>{error}
        </div>
      )}

      {/* Invitation card */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
            Supervisor Invitation
          </span>
        </div>
        <div className="space-y-1.5">
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Name</p>
            <p className="font-bold text-gray-800">{info?.name}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Email</p>
            <p className="text-indigo-700 font-semibold text-sm">{info?.email}</p>
          </div>
          {info?.department && (
            <div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Department</p>
              <p className="text-gray-700 text-sm">{info.department}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 leading-relaxed">
        <strong>No password required.</strong> After activating, you can log in at any time using your email address.
        A one-time code will be sent to your inbox each time you sign in.
      </div>

      <button
        onClick={handleActivate}
        disabled={step === 'activating'}
        className="w-full py-3.5 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-md hover:shadow-lg">
        {step === 'activating'
          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Activating…</>
          : '🚀 Confirm & Activate Account'
        }
      </button>
    </div>
  )
}

export default function SupervisorSetupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #312e81 0%, #1e1b4b 50%, #0f0e2a 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white/10 backdrop-blur rounded-3xl flex items-center justify-center mx-auto mb-4 border border-white/20">
            <span className="text-4xl">🏛️</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Activate Your Account</h1>
          <p className="text-indigo-300 text-sm mt-1">DICT DTC Practicum Coordinator Portal</p>
        </div>
        <div className="bg-white rounded-3xl shadow-2xl p-7">
          <Suspense fallback={<div className="text-center py-8 text-gray-400">Loading…</div>}>
            <SetupForm />
          </Suspense>
        </div>
        <p className="text-center text-indigo-400 text-xs mt-6">
          Digital Transformation Center — Region V
        </p>
      </div>
    </div>
  )
}
