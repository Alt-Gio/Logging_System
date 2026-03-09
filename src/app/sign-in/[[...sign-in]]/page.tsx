import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
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

      {/* Ambient glow blobs */}
      <div style={{
        position: 'fixed', top: '-120px', left: '-100px', width: '500px', height: '500px',
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,56,168,0.14) 0%, transparent 65%)',
        pointerEvents: 'none', zIndex: 0,
      }}/>
      <div style={{
        position: 'fixed', bottom: '-140px', right: '-80px', width: '440px', height: '440px',
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(206,17,38,0.09) 0%, transparent 65%)',
        pointerEvents: 'none', zIndex: 0,
      }}/>
      <div style={{
        position: 'fixed', bottom: '100px', left: '5%', width: '300px', height: '300px',
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(252,209,22,0.08) 0%, transparent 65%)',
        pointerEvents: 'none', zIndex: 0,
      }}/>

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>

        {/* Branding card */}
        <div style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.75)',
          borderRadius: '24px',
          boxShadow: '0 8px 48px rgba(0,56,168,0.12), 0 1px 3px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          marginBottom: '16px',
          animation: 'fadeInUp 0.5s cubic-bezier(.16,1,.3,1) both',
        }}>
          {/* PH tri-color top stripe */}
          <div style={{ display: 'flex', height: '5px' }}>
            <div style={{ flex: 1, background: '#0038A8' }}/>
            <div style={{ flex: 1, background: '#CE1126' }}/>
            <div style={{ flex: 1, background: '#FCD116' }}/>
          </div>

          <div style={{ padding: '28px 32px 24px' }}>
            {/* Logos row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div style={{
                width: '60px', height: '60px', borderRadius: '16px', flexShrink: 0,
                background: 'linear-gradient(135deg, #001f6b, #0038a8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(0,56,168,0.30)',
              }}>
                <img src="/dict-seal.png" alt="DICT" style={{ width: '44px', height: '44px', objectFit: 'contain' }}/>
              </div>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                  Republic of the Philippines
                </p>
                <p style={{ fontSize: '15px', fontWeight: 800, color: '#0038a8', lineHeight: 1.2, marginBottom: '2px' }}>
                  DICT Region V
                </p>
                <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.3 }}>
                  Digital Transformation Center
                </p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(0,56,168,0.08)', paddingTop: '20px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginBottom: '6px', fontFamily: "'Sora', sans-serif" }}>
                Staff Portal
              </h1>
              <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
                Access is restricted to invited DICT staff members only. Sign in with your Clerk account to continue.
              </p>
            </div>
          </div>
        </div>

        {/* Clerk SignIn */}
        <div style={{ animation: 'fadeInUp 0.5s 0.08s cubic-bezier(.16,1,.3,1) both' }}>
          <SignIn
            appearance={{
              layout: { logoPlacement: 'none', showOptionalFields: false },
              variables: {
                colorPrimary:        '#0038a8',
                colorBackground:     'rgba(255,255,255,0.88)',
                borderRadius:        '20px',
                fontFamily:          "'Plus Jakarta Sans', sans-serif",
                fontWeight:          { bold: '700', normal: '500', medium: '600' },
                colorText:           '#0f172a',
                colorTextSecondary:  '#64748b',
                colorInputBackground:'rgba(255,255,255,0.9)',
                colorInputText:      '#0f172a',
                spacingUnit:         '18px',
              },
              elements: {
                card:              'backdrop-blur-xl border border-white/70',
                headerTitle:       'hidden',
                headerSubtitle:    'hidden',
                formButtonPrimary: 'font-bold tracking-wide shadow-lg transition-all duration-200',
                footerActionLink:  'font-semibold',
                formFieldInput:    'rounded-xl border-gray-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100',
                formFieldLabel:    'font-semibold text-xs uppercase tracking-wide text-slate-500',
                dividerLine:       'bg-gray-100',
                socialButtonsBlockButton: 'border-gray-200 font-semibold hover:bg-slate-50',
              }
            }}
          />
        </div>

        {/* Footer note */}
        <p style={{
          textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '20px',
          animation: 'fadeIn 0.6s 0.2s ease both',
        }}>
          Not invited yet?{' '}
          <a href="mailto:region5@dict.gov.ph" style={{ color: '#0038a8', fontWeight: 700, textDecoration: 'none' }}>
            Contact your administrator
          </a>
        </p>

        <p style={{ textAlign: 'center', fontSize: '11px', color: '#cbd5e1', marginTop: '8px' }}>
          DICT Region V · Legazpi City, Albay · © {new Date().getFullYear()}
        </p>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
