'use client'
import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function AuthGuidePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/sign-in')
  }, [status, router])

  if (status === 'loading' || !session) return null
  const user = session.user

  const steps = [
    {
      num: '01', icon: '👤', title: 'Admin Creates Your Account',
      color: '#0038a8', bg: 'rgba(0,56,168,0.06)',
      items: [
        'A Super Admin opens the Admin Panel and goes to the Staff tab.',
        'They click "+ Add Staff" and enter your name and username.',
        'A temporary password is assigned — you will change it on first login.',
        'Your account is created instantly in the self-hosted PostgreSQL database.',
      ]
    },
    {
      num: '02', icon: '�', title: 'Sign In',
      color: '#7c3aed', bg: 'rgba(124,58,237,0.06)',
      items: [
        'Go to /sign-in (or click any admin link — you will be redirected).',
        'Enter your username and password.',
        'Sessions are stored as secure JWT cookies — no external auth provider.',
        'You are taken directly to the admin dashboard.',
      ]
    },
    {
      num: '03', icon: '�', title: 'Security & Sessions',
      color: '#059669', bg: 'rgba(5,150,105,0.06)',
      items: [
        'Sessions expire after 8 hours of inactivity.',
        'Login attempts are rate-limited: 5 failures locks the IP for 15 minutes.',
        'Passwords are hashed with bcrypt (cost factor 12).',
        'The system runs fully self-hosted behind Cloudflare WAF — PH-only access.',
      ]
    },
    {
      num: '04', icon: '👥', title: 'Manage Staff Accounts',
      color: '#d97706', bg: 'rgba(217,119,6,0.06)',
      items: [
        'Super Admins can add, edit, and deactivate staff accounts.',
        'Roles: SUPER_ADMIN (full access) and STAFF (read + limited write).',
        'Go to Admin Panel → Staff tab to manage all accounts.',
        'Contact your Super Admin to reset a forgotten password.',
      ]
    },
  ]

  const faqs = [
    { q: 'Can anyone create an account?', a: 'No. Account creation is admin-only. A Super Admin must create your account directly in the system. There is no public sign-up page.' },
    { q: 'I forgot my password. What do I do?', a: 'Contact your Super Admin. They can reset your password via the Staff tab in the Admin Panel.' },
    { q: 'What environment variables are required for auth?', a: 'AUTH_SECRET (random string ≥32 chars) and DATABASE_URL (PostgreSQL connection string). Run: openssl rand -base64 32 to generate AUTH_SECRET.' },
    { q: 'How do I update my profile?', a: 'Go to Admin Panel → Staff tab → your account row → Edit. You can update your name and password there.' },
    { q: 'What if sign-in keeps redirecting me?', a: 'Ensure AUTH_SECRET is set in your environment and DATABASE_URL points to a running PostgreSQL 16 instance. Check Docker container logs for errors.' },
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
              Auth Guide
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>{user.name}</span>
            <button onClick={() => signOut({ callbackUrl: '/sign-in' })} style={{ padding: '6px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.20)', background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.8)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Sign Out</button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <div style={{ fontSize: '52px', marginBottom: '14px' }}>🔐</div>
          <h1 style={{ fontSize: '30px', fontWeight: 800, color: '#0f172a', marginBottom: '10px', fontFamily: "'Sora', sans-serif" }}>
            Staff Authentication Guide
          </h1>
          <p style={{ fontSize: '15px', color: '#64748b', maxWidth: '520px', margin: '0 auto', lineHeight: 1.7 }}>
            The DTC admin panel uses <strong style={{ color: '#0038a8' }}>NextAuth.js v5</strong> for secure, self-hosted authentication.
            Only staff members with an account created by a Super Admin can sign in.
          </p>
        </div>

        {/* Signed in as */}
        <div style={{
          background: 'rgba(0,56,168,0.06)', border: '1px solid rgba(0,56,168,0.15)',
          borderRadius: '20px', padding: '18px 24px', marginBottom: '36px',
          display: 'flex', alignItems: 'center', gap: '16px',
        }}>
          <div style={{ fontSize: '28px' }}>✅</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, color: '#0038a8', fontSize: '14px', margin: '0 0 2px' }}>
              You&apos;re currently signed in as {user.name}
            </p>
            <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
              Role: {user.role} · ID: {user.id?.slice(0,8)}…
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/sign-in' })}
            style={{ padding: '8px 18px', borderRadius: '10px', border: '1px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.06)', color: '#dc2626', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            Sign Out
          </button>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '28px' }}>
          {steps.map((s, si) => (
            <div key={s.num} style={{
              background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.70)', borderRadius: '20px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)', overflow: 'hidden',
              animation: `fadeInUp 0.4s ${si * 0.07}s both`,
            }}>
              <div style={{ background: s.bg, borderBottom: `1px solid ${s.color}1a`, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0, boxShadow: `0 4px 14px ${s.color}40` }}>
                  {s.icon}
                </div>
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 800, color: s.color, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>Step {s.num}</p>
                  <p style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', margin: 0, fontFamily: "'Sora', sans-serif" }}>{s.title}</p>
                </div>
              </div>
              <ol style={{ listStyle: 'none', padding: '18px 24px', margin: 0, display: 'flex', flexDirection: 'column', gap: '11px' }}>
                {s.items.map((item, i) => (
                  <li key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: s.bg, border: `1.5px solid ${s.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: s.color, flexShrink: 0, marginTop: '1px' }}>
                      {i + 1}
                    </div>
                    <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, margin: 0 }}>{item}</p>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        {/* Env vars reference */}
        <div style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.70)', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', marginBottom: '20px' }}>
          <h3 style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a', marginBottom: '6px', fontFamily: "'Sora', sans-serif" }}>⚙️ Required Environment Variables</h3>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>Set these in your Docker .env file or server environment</p>
          <div style={{ background: '#0f172a', borderRadius: '14px', padding: '18px 20px', fontFamily: "'JetBrains Mono', monospace" }}>
            {[
              ['AUTH_SECRET', 'openssl rand -base64 32'],
              ['DATABASE_URL', 'postgresql://user:pass@postgres:5432/dict_db'],
              ['NEXTAUTH_URL', 'https://your-domain.com'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: '8px', marginBottom: '6px', fontSize: '12px', flexWrap: 'wrap' }}>
                <span style={{ color: '#7dd3fc' }}>{k}</span>
                <span style={{ color: '#6b7280' }}>=</span>
                <span style={{ color: '#86efac' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.70)', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', marginBottom: '20px' }}>
          <h3 style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a', marginBottom: '16px', fontFamily: "'Sora', sans-serif" }}>🔗 Quick Links</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            {[
              { href: '/admin',             icon: '📊', label: 'Admin Dashboard', desc: 'Logs, stats, settings' },
              { href: '/admin/invite',      icon: '✉️', label: 'Invite Staff',    desc: 'Send invitations'    },
              { href: '/sign-in',           icon: '🔑', label: 'Sign In Page',    desc: 'Staff login'         },
              { href: '/',                  icon: '📋', label: 'Client Logbook',  desc: 'Public front page'   },
            ].map(l => (
              <a key={l.href} href={l.href} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: '14px', border: '1px solid rgba(0,56,168,0.12)', background: 'rgba(0,56,168,0.04)', textDecoration: 'none' }}>
                <span style={{ fontSize: '20px' }}>{l.icon}</span>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{l.label}</p>
                  <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>{l.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.70)', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a', marginBottom: '18px', fontFamily: "'Sora', sans-serif" }}>❓ Frequently Asked Questions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {faqs.map((faq, i) => (
              <div key={i} style={{ borderBottom: i < faqs.length - 1 ? '1px solid rgba(226,232,240,0.6)' : 'none', paddingBottom: i < faqs.length - 1 ? '16px' : '0' }}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '0 0 5px' }}>Q: {faq.q}</p>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.65 }}>{faq.a}</p>
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
