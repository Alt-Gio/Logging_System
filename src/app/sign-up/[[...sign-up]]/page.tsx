import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      zIndex: 1,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      {/* Ambient blobs */}
      <div style={{ position: 'fixed', top: '-120px', left: '-100px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,56,168,0.14) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }}/>
      <div style={{ position: 'fixed', bottom: '-140px', right: '-80px', width: '440px', height: '440px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(206,17,38,0.09) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }}/>

      <div style={{ width: '100%', maxWidth: '480px', position: 'relative', zIndex: 1 }}>

        {/* Branding card */}
        <div style={{
          background: 'rgba(255,255,255,0.87)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.75)', borderRadius: '24px',
          boxShadow: '0 8px 48px rgba(0,56,168,0.12)', overflow: 'hidden', marginBottom: '16px',
          animation: 'fadeInUp 0.5s cubic-bezier(.16,1,.3,1) both',
        }}>
          <div style={{ display: 'flex', height: '5px' }}>
            <div style={{ flex: 1, background: '#0038A8' }}/><div style={{ flex: 1, background: '#CE1126' }}/><div style={{ flex: 1, background: '#FCD116' }}/>
          </div>
          <div style={{ padding: '24px 32px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg,#001f6b,#0038a8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 16px rgba(0,56,168,0.30)' }}>
              <img src="/dict-seal.png" alt="DICT" style={{ width: '38px', height: '38px', objectFit: 'contain' }}/>
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>DICT Region V — DTC</p>
              <h1 style={{ fontSize: '19px', fontWeight: 800, color: '#0f172a', marginBottom: '3px', fontFamily: "'Sora', sans-serif" }}>Create Staff Account</h1>
              <p style={{ fontSize: '12px', color: '#94a3b8' }}>Complete your profile to access the admin panel</p>
            </div>
          </div>
        </div>

        {/* Clerk SignUp */}
        <div style={{ animation: 'fadeInUp 0.5s 0.08s cubic-bezier(.16,1,.3,1) both' }}>
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

      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  )
}
