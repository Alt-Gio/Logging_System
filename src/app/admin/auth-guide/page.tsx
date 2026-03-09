'use client'
import { useUser, UserButton, SignOutButton } from '@clerk/nextjs'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthGuidePage() {
  const { user, isLoaded, isSignedIn } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push('/sign-in')
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded || !isSignedIn) return null

  const steps = [
    {
      num: '01', icon: '✉️', title: 'Get Invited',
      color: '#0038a8', bg: 'rgba(0,56,168,0.06)',
      steps: [
        'An existing admin goes to the admin panel → clicks "✉️ Invite Staff" in the top bar',
        'They enter your email address and click "Send Invitations"',
        'You receive an email from Clerk with a secure invite link',
        'Alternatively, they generate a one-time link and share it with you directly',
      ]
    },
    {
      num: '02', icon: '📝', title: 'Create Your Account',
      color: '#7c3aed', bg: 'rgba(124,58,237,0.06)',
      steps: [
        'Click the invite link in your email — it takes you to /sign-up',
        'Enter your first name, last name, and create a password',
        'Verify your email address with the code sent by Clerk',
        'Your account is created and you\'re redirected to the admin panel',
      ]
    },
    {
      num: '03', icon: '🔑', title: 'Sign In Next Time',
      color: '#059669', bg: 'rgba(5,150,105,0.06)',
      steps: [
        'Go to yourapp.railway.app/sign-in or click any admin link',
        'Enter your email and password',
        'You\'re taken directly to the admin dashboard',
        'Use the profile button (top-right) to manage your account or sign out',
      ]
    },
    {
      num: '04', icon: '👥', title: 'Invite More Staff',
      color: '#d97706', bg: 'rgba(217,119,6,0.06)',
      steps: [
        'In the admin panel, click "✉️ Invite Staff" in the top navigation',
        'Enter one or more email addresses (comma-separated)',
        'Or generate a one-time link for someone without an email',
        'They follow the same steps above — only invited accounts can join',
      ]
    },
  ]

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Plus Jakarta Sans', sans-serif", position: 'relative', zIndex: 1 }}>

      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg,#001a60,#0038a8,#0050d0)', boxShadow: '0 4px 24px rgba(0,56,168,0.30)', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', height: '4px' }}>
          <div style={{ flex:1, background:'#0038A8' }}/><div style={{ flex:1, background:'#CE1126' }}/><div style={{ flex:1, background:'#FCD116' }}/>
        </div>
        <div style={{ maxWidth: '860px', margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <a href="/admin" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', textDecoration: 'none', fontWeight: 600, padding: '6px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)' }}>
              ← Admin Panel
            </a>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '15px', fontFamily: "'Sora', sans-serif" }}>
              How to Sign In — Auth Guide
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>{user.fullName ?? user.username}</span>
            <UserButton afterSignOutUrl="/sign-in"/>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔐</div>
          <h1 style={{ fontSize: '30px', fontWeight: 800, color: '#0f172a', marginBottom: '12px', fontFamily: "'Sora', sans-serif" }}>
            Staff Authentication Guide
          </h1>
          <p style={{ fontSize: '15px', color: '#64748b', maxWidth: '520px', margin: '0 auto', lineHeight: 1.7 }}>
            The DTC admin panel uses <strong style={{ color: '#0038a8' }}>Clerk</strong> for secure authentication.
            Only invited staff members can create accounts and access the system.
          </p>
        </div>

        {/* Current user card */}
        <div style={{
          background: 'rgba(0,56,168,0.06)', border: '1px solid rgba(0,56,168,0.15)',
          borderRadius: '20px', padding: '20px 24px', marginBottom: '36px',
          display: 'flex', alignItems: 'center', gap: '16px',
        }}>
          <div style={{ fontSize: '32px' }}>✅</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, color: '#0038a8', fontSize: '15px', margin: '0 0 3px' }}>
              You're signed in as {user.fullName ?? user.username}
            </p>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
              {user.primaryEmailAddress?.emailAddress} · Account created {new Date(user.createdAt!).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <SignOutButton redirectUrl="/sign-in">
            <button style={{ padding: '8px 18px', borderRadius: '10px', border: '1px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.06)', color: '#dc2626', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Sign Out
            </button>
          </SignOutButton>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {steps.map((s, si) => (
            <div key={s.num} style={{
              background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.70)', borderRadius: '20px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)', overflow: 'hidden',
              animation: `fadeInUp 0.4s ${si * 0.07}s both`,
            }}>
              <div style={{ background: s.bg, borderBottom: `1px solid ${s.color}18`, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0, boxShadow: `0 4px 14px ${s.color}40` }}>
                  {s.icon}
                </div>
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 800, color: s.color, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>Step {s.num}</p>
                  <p style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', margin: 0, fontFamily: "'Sora', sans-serif" }}>{s.title}</p>
                </div>
              </div>
              <div style={{ padding: '20px 24px' }}>
                <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {s.steps.map((step, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: s.bg, border: `1.5px solid ${s.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: s.color, flexShrink: 0, marginTop: '1px' }}>
                        {i + 1}
                      </div>
                      <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, margin: 0 }}>{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div style={{ marginTop: '36px', background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.70)', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a', marginBottom: '16px', fontFamily: "'Sora', sans-serif" }}>
            Quick Links
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            {[
              { href: '/admin',        icon: '📊', label: 'Admin Dashboard',  desc: 'Logs, stats, settings'    },
              { href: '/admin/invite', icon: '✉️', label: 'Invite Staff',     desc: 'Send invitations'         },
              { href: '/sign-in',      icon: '🔑', label: 'Sign In Page',     desc: 'Staff login'              },
              { href: '/',             icon: '📋', label: 'Client Logbook',   desc: 'Public front page'        },
            ].map(l => (
              <a key={l.href} href={l.href} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: '14px', border: '1px solid rgba(0,56,168,0.12)', background: 'rgba(0,56,168,0.04)', textDecoration: 'none', transition: 'all 0.2s' }}>
                <span style={{ fontSize: '22px' }}>{l.icon}</span>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{l.label}</p>
                  <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>{l.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div style={{ marginTop: '20px', background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.70)', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a', marginBottom: '18px', fontFamily: "'Sora', sans-serif" }}>
            Frequently Asked Questions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { q: 'Can anyone create an account?', a: 'No. The Clerk allowlist is enabled — only email addresses that have been invited can sign up. Anyone else will be blocked.' },
              { q: 'I lost my invite email. What do I do?', a: 'Ask your administrator to go to ✉️ Invite Staff and send a new invite to your email, or generate a fresh one-time link.' },
              { q: 'Can I reset my password?', a: 'Yes. On the /sign-in page, click "Forgot password?" and enter your email. Clerk will send a password reset link.' },
              { q: 'What happens if I sign out?', a: 'You\'ll be redirected to /sign-in. Your data is never lost — just sign back in with your email and password.' },
              { q: 'How do I update my name or email?', a: 'Click your profile avatar (top-right corner of the admin panel) → Manage Account. You can update your profile from Clerk\'s account portal.' },
            ].map((faq, i) => (
              <div key={i} style={{ borderBottom: i < 4 ? '1px solid rgba(226,232,240,0.6)' : 'none', paddingBottom: i < 4 ? '16px' : '0' }}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>❓ {faq.q}</p>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.6 }}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  )
}
