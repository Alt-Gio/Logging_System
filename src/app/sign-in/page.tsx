'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function SignInForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl  = searchParams.get('callbackUrl') || '/admin'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    const err = searchParams.get('error')
    if (err === 'CredentialsSignin') setError('Invalid username or password.')
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) return
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: username.trim().toLowerCase(), password }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(callbackUrl)
        router.refresh()
      } else {
        setError(data.error || 'Invalid username or password.')
        setLoading(false)
      }
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', position: 'relative', zIndex: 1,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>

      {/* Ambient glows */}
      <div style={{ position:'fixed', top:'-120px', left:'-100px', width:'500px', height:'500px', borderRadius:'50%', background:'radial-gradient(circle, rgba(0,56,168,0.14) 0%, transparent 65%)', pointerEvents:'none', zIndex:0 }}/>
      <div style={{ position:'fixed', bottom:'-140px', right:'-80px', width:'440px', height:'440px', borderRadius:'50%', background:'radial-gradient(circle, rgba(206,17,38,0.09) 0%, transparent 65%)', pointerEvents:'none', zIndex:0 }}/>
      <div style={{ position:'fixed', bottom:'100px', left:'5%', width:'300px', height:'300px', borderRadius:'50%', background:'radial-gradient(circle, rgba(252,209,22,0.08) 0%, transparent 65%)', pointerEvents:'none', zIndex:0 }}/>

      <div style={{ width:'100%', maxWidth:'420px', position:'relative', zIndex:1 }}>

        {/* Branding card */}
        <div style={{
          background:'rgba(255,255,255,0.85)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
          border:'1px solid rgba(255,255,255,0.75)', borderRadius:'24px',
          boxShadow:'0 8px 48px rgba(0,56,168,0.12), 0 1px 3px rgba(0,0,0,0.06)', overflow:'hidden',
          marginBottom:'16px', animation:'fadeInUp 0.5s cubic-bezier(.16,1,.3,1) both',
        }}>
          <div style={{ display:'flex', height:'5px' }}>
            <div style={{ flex:1, background:'#0038A8' }}/>
            <div style={{ flex:1, background:'#CE1126' }}/>
            <div style={{ flex:1, background:'#FCD116' }}/>
          </div>
          <div style={{ padding:'28px 32px 24px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'24px' }}>
              <div style={{ width:'60px', height:'60px', borderRadius:'16px', flexShrink:0, background:'linear-gradient(135deg, #001f6b, #0038a8)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(0,56,168,0.30)' }}>
                <img src="/dict-seal.png" alt="DICT" style={{ width:'44px', height:'44px', objectFit:'contain' }} onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none'}}/>
              </div>
              <div>
                <p style={{ fontSize:'11px', fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'4px' }}>Republic of the Philippines</p>
                <p style={{ fontSize:'15px', fontWeight:800, color:'#0038a8', lineHeight:1.2, marginBottom:'2px' }}>DICT Region V</p>
                <p style={{ fontSize:'12px', color:'#64748b', lineHeight:1.3 }}>Digital Transformation Center</p>
              </div>
            </div>
            <div style={{ borderTop:'1px solid rgba(0,56,168,0.08)', paddingTop:'20px' }}>
              <h1 style={{ fontSize:'22px', fontWeight:800, color:'#0f172a', marginBottom:'6px', fontFamily:"'Sora', sans-serif" }}>Staff Portal</h1>
              <p style={{ fontSize:'13px', color:'#94a3b8', lineHeight:1.5 }}>
                Access is restricted to authorised DICT staff. Sign in with your credentials to continue.
              </p>
            </div>
          </div>
        </div>

        {/* Login form */}
        <div style={{ animation:'fadeInUp 0.5s 0.08s cubic-bezier(.16,1,.3,1) both' }}>
          <form onSubmit={handleSubmit} style={{
            background:'rgba(255,255,255,0.88)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
            border:'1px solid rgba(255,255,255,0.75)', borderRadius:'20px',
            boxShadow:'0 8px 40px rgba(0,56,168,0.10)', padding:'28px',
          }}>
            <div style={{ marginBottom:'16px' }}>
              <label style={{ display:'block', fontSize:'11px', fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'7px' }}>Username</label>
              <input
                type="text" value={username} onChange={e=>setUsername(e.target.value)}
                autoComplete="username" autoFocus required
                placeholder="e.g. admin"
                style={{ width:'100%', boxSizing:'border-box', padding:'12px 14px', borderRadius:'12px', border:'1.5px solid rgba(0,0,0,0.10)', fontSize:'14px', fontFamily:'inherit', background:'rgba(255,255,255,0.9)', outline:'none', color:'#0f172a', transition:'border-color 0.2s' }}
                onFocus={e=>e.currentTarget.style.borderColor='#0038a8'}
                onBlur={e=>e.currentTarget.style.borderColor='rgba(0,0,0,0.10)'}
              />
            </div>
            <div style={{ marginBottom:'20px' }}>
              <label style={{ display:'block', fontSize:'11px', fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'7px' }}>Password</label>
              <input
                type="password" value={password} onChange={e=>setPassword(e.target.value)}
                autoComplete="current-password" required
                placeholder="••••••••"
                style={{ width:'100%', boxSizing:'border-box', padding:'12px 14px', borderRadius:'12px', border:'1.5px solid rgba(0,0,0,0.10)', fontSize:'14px', fontFamily:'inherit', background:'rgba(255,255,255,0.9)', outline:'none', color:'#0f172a', transition:'border-color 0.2s' }}
                onFocus={e=>e.currentTarget.style.borderColor='#0038a8'}
                onBlur={e=>e.currentTarget.style.borderColor='rgba(0,0,0,0.10)'}
              />
            </div>

            {error && (
              <div style={{ marginBottom:'16px', padding:'11px 14px', borderRadius:'12px', background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.2)', color:'#dc2626', fontSize:'13px', fontWeight:500 }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={loading||!username||!password} style={{
              width:'100%', padding:'13px', borderRadius:'14px', border:'none', cursor:'pointer',
              fontFamily:'inherit', fontSize:'14px', fontWeight:800,
              background:'linear-gradient(135deg, #0038a8, #0050d0)',
              color:'#fff', boxShadow:'0 4px 18px rgba(0,56,168,0.30)',
              opacity: loading||!username||!password ? 0.5 : 1,
              transition:'all 0.2s',
            }}>
              {loading ? '⏳ Signing in…' : '→ Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign:'center', fontSize:'12px', color:'#94a3b8', marginTop:'20px', animation:'fadeIn 0.6s 0.2s ease both' }}>
          No account?{' '}
          <a href="mailto:region5@dict.gov.ph" style={{ color:'#0038a8', fontWeight:700, textDecoration:'none' }}>Contact your administrator</a>
        </p>
        <p style={{ textAlign:'center', fontSize:'11px', color:'#cbd5e1', marginTop:'8px' }}>
          DICT Region V · Legazpi City, Albay · © {new Date().getFullYear()}
        </p>
      </div>

      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
      `}</style>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
