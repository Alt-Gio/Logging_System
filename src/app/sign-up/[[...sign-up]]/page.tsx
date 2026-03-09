'use client'
import { useSearchParams } from 'next/navigation'
import { SignUp } from '@clerk/nextjs'
import { Suspense } from 'react'

function InviteOnlyGate() {
  const params = useSearchParams()
  // Clerk invitation token arrives as __clerk_ticket
  const hasTicket = params.has('__clerk_ticket')

  const headerCard = (
    <div style={{
      background: 'rgba(255,255,255,0.87)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.75)', borderRadius: '24px',
      boxShadow: '0 8px 48px rgba(0,56,168,0.12)', overflow: 'hidden', marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', height: '5px' }}>
        <div style={{ flex: 1, background: '#0038A8' }}/>
        <div style={{ flex: 1, background: '#CE1126' }}/>
        <div style={{ flex: 1, background: '#FCD116' }}/>
      </div>
      <div style={{ padding: '24px 32px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg,#001f6b,#0038a8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 16px rgba(0,56,168,0.30)' }}>
          <img src="/dict-seal.png" alt="DICT" style={{ width: '38px', height: '38px', objectFit: 'contain' }}/>
        </div>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>DICT Region V — DTC</p>
          <h1 style={{ fontSize: '19px', fontWeight: 800, color: '#0f172a', marginBottom: '3px', fontFamily: "'Sora', sans-serif" }}>Staff Registration</h1>
          <p style={{ fontSize: '12px', color: '#94a3b8' }}>Digital Transformation Center Admin System</p>
        </div>
      </div>
    </div>
  )

  if (!hasTicket) {
    return (
      <div style={{ width: '100%', maxWidth: '480px', position: 'relative', zIndex: 1 }}>
        {headerCard}
        <div style={{
          background: 'rgba(255,255,255,0.87)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.75)', borderRadius: '24px',
          boxShadow: '0 8px 48px rgba(0,56,168,0.12)', padding: '40px 32px',
          textAlign: 'center',
        }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg,#f0f4ff,#dde8ff)', border: '2px solid rgba(0,56,168,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '32px' }}>
            🔒
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginBottom: '8px', fontFamily: "'Sora', sans-serif" }}>
            Invitation Required
          </h2>
          <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6, marginBottom: '24px' }}>
            Access to the DICT DTC Admin System is <strong>by invitation only</strong>. Self-registration is not permitted.
          </p>
          <div style={{ background: '#f8faff', border: '1px solid #dde8ff', borderRadius: '16px', padding: '16px 20px', marginBottom: '24px', textAlign: 'left' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#0038a8', marginBottom: '8px' }}>How to get access:</p>
            <ul style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.8, paddingLeft: '16px', margin: 0 }}>
              <li>Contact your DICT Region V supervisor</li>
              <li>Request an invitation to your official email</li>
              <li>Click the link in your invitation email</li>
            </ul>
          </div>
          <a href="/sign-in" style={{
            display: 'inline-block', padding: '12px 32px', borderRadius: '14px',
            background: 'linear-gradient(135deg,#0038a8,#0047cc)', color: '#fff',
            fontWeight: 700, fontSize: '14px', textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(0,56,168,0.25)',
          }}>
            Already have an account? Sign In
          </a>
          <p style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '20px' }}>
            DICT Region V · Legazpi City, Albay 4500<br/>
            📧 region5@dict.gov.ph
          </p>
        </div>
      </div>
    )
  }

  // Valid invitation ticket — show the Clerk SignUp component
  return (
    <div style={{ width: '100%', maxWidth: '480px', position: 'relative', zIndex: 1 }}>
      {headerCard}
      <div style={{
        background: '#ddfbe8', border: '1px solid #86efac', borderRadius: '16px',
        padding: '10px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span style={{ fontSize: '18px' }}>✅</span>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#166534', margin: 0 }}>
          Valid invitation detected — complete your profile below.
        </p>
      </div>
      <div>
        <SignUp
          appearance={{
            layout: { logoPlacement: 'none' },
            variables: {
              colorPrimary: '#0038a8', colorBackground: 'rgba(255,255,255,0.88)',
              borderRadius: '20px', fontFamily: "'Plus Jakarta Sans', sans-serif",
              colorText: '#0f172a', colorTextSecondary: '#64748b',
              colorInputBackground: 'rgba(255,255,255,0.9)', spacingUnit: '18px',
            },
            elements: {
              card: 'backdrop-blur-xl border border-white/70',
              headerTitle: 'hidden', headerSubtitle: 'hidden',
              formButtonPrimary: 'font-bold tracking-wide shadow-lg',
              footerActionLink: 'font-semibold',
              formFieldInput: 'rounded-xl border-gray-200 focus:border-blue-600',
              formFieldLabel: 'font-semibold text-xs uppercase tracking-wide text-slate-500',
            }
          }}
        />
      </div>
      <p style={{ textAlign: 'center', fontSize: '11px', color: '#cbd5e1', marginTop: '16px' }}>
        DICT Region V · Legazpi City, Albay
      </p>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', position: 'relative', zIndex: 1,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{ position: 'fixed', top: '-120px', left: '-100px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,56,168,0.14) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }}/>
      <div style={{ position: 'fixed', bottom: '-140px', right: '-80px', width: '440px', height: '440px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(206,17,38,0.09) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }}/>

      <Suspense fallback={
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ width: '40px', height: '40px', border: '4px solid #0038a8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}/>
          <p>Loading…</p>
        </div>
      }>
        <InviteOnlyGate/>
      </Suspense>

      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
