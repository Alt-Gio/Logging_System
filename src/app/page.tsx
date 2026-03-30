'use client'
import Link from 'next/link'
import { useEffect, useRef, useState, useCallback } from 'react'

type Ann = { id: string; title: string; content: string; type?: string; urgent: boolean; createdAt: string; expiresAt?: string; imageUrl?: string; featured?: boolean; highlight?: string }
type FPSettings = { hero_media_url: string; hero_media_type: 'image'|'video'|'none'; office_hours: string; office_location: string }
type LiveStats = { todayCount: number; activeInterns: number; activeNow: number }
type FBPost = { id: string; message?: string; story?: string; created_time: string; full_picture?: string; permalink_url?: string }

const FP_DEFAULTS: FPSettings = {
  hero_media_url:  '',
  hero_media_type: 'none',
  office_hours:    'Monday – Friday  8:00 AM – 5:00 PM',
  office_location: '2/F Post Telecom Bldg., Lapu Lapu St., Legazpi City',
}

// ── Keys to sync from /api/settings ─────────────────────────────────────────
const FP_KEYS = Object.keys(FP_DEFAULTS)

function useCount(target: number, dur: number, go: boolean) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!go || target === 0) return
    const t0 = performance.now()
    const step = (ts: number) => {
      const p = Math.min((ts - t0) / dur, 1)
      setV(Math.floor(p * target))
      if (p < 1) requestAnimationFrame(step); else setV(target)
    }
    requestAnimationFrame(step)
  }, [target, dur, go])
  return v
}

export default function HomePage() {
  const [anns,      setAnns]      = useState<Ann[]>([])
  const [expanded,  setExpanded]  = useState<Ann | null>(null)
  const [fbPosts,   setFbPosts]   = useState<FBPost[]>([])
  const [menuOpen,  setMenuOpen]  = useState(false)
  const [time,      setTime]      = useState('')
  const [sActive,   setSActive]   = useState(false)
  const [live,      setLive]      = useState<LiveStats | null>(null)
  const [fp,        setFp]        = useState<FPSettings>(FP_DEFAULTS)
  const [imgOk,     setImgOk]     = useState(false)
  // Video signage mode — after 10 s of video playing, UI fades out
  const [signage,   setSignage]   = useState(false)
  const signageTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sRef = useRef<HTMLDivElement>(null)

  const active = anns.filter(a => !a.expiresAt || new Date(a.expiresAt) > new Date())
  const now = new Date()
  const isOpen = now.getDay() >= 1 && now.getDay() <= 5 && now.getHours() >= 8 && now.getHours() < 17
  const cLogged  = useCount(live?.todayCount ?? 0, 1200, sActive)
  const cInterns = useCount(live?.activeInterns ?? 0, 1200, sActive)
  const hasMedia = !!(fp.hero_media_url && fp.hero_media_type !== 'none')
  const isVideo  = hasMedia && fp.hero_media_type === 'video'

  // Wake up from signage mode on any interaction
  const wakeUp = useCallback(() => {
    if (!isVideo) return
    setSignage(false)
    if (signageTimer.current) clearTimeout(signageTimer.current)
    signageTimer.current = setTimeout(() => setSignage(true), 10_000)
  }, [isVideo])

  useEffect(() => {
    fetch('/api/facebook/posts').then(r => r.json()).then(d => Array.isArray(d) && setFbPosts(d)).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/announcements').then(r => r.json()).then(d => Array.isArray(d) && setAnns(d)).catch(() => {})
    fetch('/api/settings').then(r => r.json()).then((d: Record<string,string>) => {
      setFp(prev => ({ ...prev, ...Object.fromEntries(Object.entries(d).filter(([k]) => FP_KEYS.includes(k))) } as FPSettings))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const go = () => fetch('/api/stats/live').then(r => r.json()).then(d => d?.todayCount != null && setLive(d)).catch(() => {})
    go(); const t = setInterval(go, 30_000); return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!sRef.current) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSActive(true); obs.disconnect() } }, { threshold: 0.2 })
    obs.observe(sRef.current); return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && setExpanded(null)
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])

  // Start signage timer when video begins
  useEffect(() => {
    if (!isVideo) { setSignage(false); if (signageTimer.current) clearTimeout(signageTimer.current); return }
    signageTimer.current = setTimeout(() => setSignage(true), 10_000)
    return () => { if (signageTimer.current) clearTimeout(signageTimer.current) }
  }, [isVideo])

  return (
    <>
      <style>{`
        @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes mIn { from{opacity:0;transform:scale(.96) translateY(8px)} to{opacity:1;transform:none} }
        @keyframes fUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        @keyframes dtcPulse { 0%,100%{opacity:.9} 50%{opacity:1} }
        .ticker{animation:ticker 40s linear infinite}
        .manim{animation:mIn .22s ease both}
        .fu0{animation:fUp .5s ease both}
        .fu1{animation:fUp .5s .15s ease both}
        .fu2{animation:fUp .5s .3s ease both}
        .fu3{animation:fUp .5s .45s ease both}
        html{scroll-behavior:smooth}
        .gc{background:rgba(255,255,255,.028);border:1px solid rgba(255,255,255,.07)}
        .glow{box-shadow:0 0 0 1px rgba(59,130,246,.35),0 6px 28px rgba(59,130,246,.18)}
        .ui-layer{transition:opacity 1.2s ease, visibility 1.2s ease}
        .ui-layer.hidden{opacity:0;visibility:hidden;pointer-events:none}
        .signage-title{animation:dtcPulse 4s ease-in-out infinite}
      `}</style>

      {/* Modal */}
      {expanded && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setExpanded(null)}>
          <div className="manim bg-[#0b1220] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto p-6 sm:p-8 relative shadow-2xl" onClick={e => e.stopPropagation()} style={{ paddingBottom: 'max(1.5rem,env(safe-area-inset-bottom))' }}>
            <button onClick={() => setExpanded(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-white">&times;</button>
            <span className={`text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full ${expanded.urgent ? 'bg-red-500/20 text-red-400 border border-red-500/25' : 'bg-blue-500/20 text-blue-400 border border-blue-500/25'}`}>
              {expanded.urgent ? '⚠ Urgent' : '📌 Announcement'}
            </span>
            <h2 className="font-black text-white text-xl leading-snug mt-4 mb-2">{expanded.title}</h2>
            <p className="text-gray-600 text-xs mb-5">Posted {new Date(expanded.createdAt).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{expanded.content}</p>
          </div>
        </div>
      )}

      <div
        className="min-h-screen bg-[#070e1b] text-white"
        onClick={isVideo ? wakeUp : undefined}
        onMouseMove={isVideo ? wakeUp : undefined}
        onTouchStart={isVideo ? wakeUp : undefined}
      >

        {/* NAV */}
        <nav className={`fixed top-0 inset-x-0 z-40 border-b border-white/[0.06] ui-layer${signage ? ' hidden' : ''}`} style={{ background: 'rgba(7,14,27,.92)', backdropFilter: 'blur(20px)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between" style={{ height: 60 }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl glow bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center font-black text-xs tracking-wide">DTC</div>
              <div>
                <p className="font-bold text-white text-sm leading-none">DICT Region V</p>
                <p className="text-gray-500 text-[10px] mt-0.5">Digital Technology Center</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-1">
              {[['#about','About'],['#services','Services'],['#events','Events'],['#offices','Offices']].map(([h,l]) => (
                <a key={h} href={h} className="px-3 py-1.5 text-gray-400 hover:text-white text-sm rounded-lg hover:bg-white/5 transition-all">{l}</a>
              ))}
              <Link href="/rules" className="px-3 py-1.5 text-gray-400 hover:text-amber-400 text-sm rounded-lg hover:bg-white/5 transition-all">Rules</Link>
              <div className="w-px h-4 bg-white/10 mx-2" />
              <Link href="/intern/login" className="px-3 py-1.5 text-gray-500 hover:text-violet-400 text-sm rounded-lg hover:bg-violet-500/5 transition-all flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400/50" />Intern Portal
              </Link>
              <Link href="/dtc-logbook" className="ml-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-white text-sm glow transition-colors">Open Logbook</Link>
            </div>
            <button onClick={() => setMenuOpen(o => !o)} className="md:hidden p-2 text-gray-400">{menuOpen ? '✕' : '☰'}</button>
          </div>
          {menuOpen && (
            <div className="md:hidden border-t border-white/[0.06] px-4 py-3 space-y-1" style={{ background: 'rgba(7,14,27,.98)' }}>
              {[['#about','🏛️ About'],['#services','🛠️ Services'],['#events','📅 Events'],['#offices','📍 Offices']].map(([href,label]) => (
                <a key={href} href={href} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-gray-300 text-sm hover:bg-white/5">{label}</a>
              ))}
              <div className="border-t border-white/[0.06] pt-2 mt-1 space-y-1">
                <Link href="/intern/login" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-violet-400 text-sm hover:bg-violet-500/5">🎓 Intern Portal</Link>
                <Link href="/supervisor/login" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-indigo-400 text-sm hover:bg-indigo-500/5">👔 Supervisor Portal</Link>
                <Link href="/dtc-logbook" onClick={() => setMenuOpen(false)} className="flex justify-center px-4 py-3 bg-blue-600 rounded-xl font-bold text-sm mt-1">🖥️ Open the Logbook</Link>
              </div>
            </div>
          )}
        </nav>

        {/* HERO — full-screen */}
        <section className="relative min-h-[100dvh] overflow-hidden" style={{ paddingTop: 60 }}>

          {/* ── Full-screen media background ── */}
          {hasMedia && (
            <div className="absolute inset-0 z-0">
              {isVideo ? (
                <video
                  src={fp.hero_media_url}
                  autoPlay muted loop playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <img
                  src={fp.hero_media_url}
                  alt="DTC"
                  onLoad={() => setImgOk(true)}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${imgOk ? 'opacity-100' : 'opacity-0'}`}
                />
              )}
              {/* Dark overlay gradient */}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(7,14,27,.55) 0%, rgba(7,14,27,.2) 40%, rgba(7,14,27,.75) 100%)' }} />
            </div>
          )}

          {/* ── Default dark bg when no media ── */}
          {!hasMedia && (
            <div className="absolute inset-0 z-0 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-950/50 via-[#070e1b] to-[#070e1b]" />
              <div className="absolute inset-0 opacity-[0.022]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.3) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
              <div className="absolute -top-32 -left-32 w-[700px] h-[700px] rounded-full opacity-[0.06] blur-3xl" style={{ background: 'radial-gradient(circle,#3b82f6,transparent)' }} />
            </div>
          )}

          {/* ── Status bar (top-left, fades in signage) ── */}
          <div className={`absolute top-[72px] left-4 sm:left-8 z-10 flex items-center gap-2 ui-layer${signage ? ' hidden' : ''}`}>
            <span className="relative flex h-2 w-2">
              <span className={`absolute inset-0 rounded-full ${isOpen ? 'bg-emerald-400' : 'bg-red-400'} opacity-60 animate-ping`} />
              <span className={`relative h-2 w-2 rounded-full ${isOpen ? 'bg-emerald-400' : 'bg-red-400'}`} />
            </span>
            <span className="text-white/60 text-xs backdrop-blur-sm">{isOpen ? 'Open · Mon–Fri 8AM–5PM' : 'Closed · Opens 8AM weekdays'}</span>
            {time && <span className="hidden sm:block text-white/30 text-[10px] font-mono pl-2.5 border-l border-white/10">{time}</span>}
          </div>

          {/* ── Live stats strip (top-right, fades in signage) ── */}
          {live && !signage && (
            <div className="absolute top-[72px] right-4 sm:right-8 z-10 ui-layer hidden sm:flex items-center gap-3">
              {[
                { v: live.activeNow,    label: 'active now',    c: 'text-emerald-300' },
                { v: cLogged,           label: 'logged today',  c: 'text-amber-300'   },
                { v: cInterns,          label: 'interns',       c: 'text-violet-300'  },
              ].map((s, i) => (
                <span key={i} className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1">
                  <span className={`font-bold text-xs ${s.c}`}>{s.v}</span>
                  <span className="text-white/30 text-[10px]">{s.label}</span>
                </span>
              ))}
            </div>
          )}

          {/* ── Fixed title — always visible (bottom-left) ── */}
          <div className="absolute bottom-0 left-0 right-0 z-10 px-6 sm:px-10 pb-6 sm:pb-10">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-end justify-between gap-6">

              {/* DTC title — non-editable, same font size as original h1 */}
              <div>
                <h1
                  className={`text-[2.6rem] sm:text-5xl lg:text-6xl xl:text-[4.2rem] font-black text-white leading-[1.05] tracking-tight drop-shadow-2xl${signage ? ' signage-title' : ' fu1'}`}
                  style={{ textShadow: '0 4px 32px rgba(0,0,0,.8)' }}
                >
                  Digital Transformation Center
                </h1>
                {/* Subtitle only when NOT in signage mode */}
                {!signage && (
                  <p className="fu2 mt-3 text-white/60 text-sm sm:text-base leading-relaxed max-w-xl drop-shadow">
                    DICT Region V · Bicol — Free digital services for every Bicolano
                  </p>
                )}
              </div>

              {/* Buttons + portals — bottom-right, fade in signage */}
              <div className={`flex flex-col items-end gap-3 ui-layer${signage ? ' hidden' : ''}`}>
                <div className="fu3 flex flex-col sm:flex-row flex-wrap gap-2 justify-end">
                  <Link href="/dtc-logbook"
                    className="flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-white text-sm glow transition-all shadow-xl">
                    🖥️ Open Logbook →
                  </Link>
                  <Link href="/intern-logbook"
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-gray-100 text-sm transition-all shadow-lg"
                    style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.15)', backdropFilter: 'blur(8px)' }}>
                    🎓 Intern Logbook
                  </Link>
                  <a href="#events"
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-gray-100 text-sm transition-all shadow-lg"
                    style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.15)', backdropFilter: 'blur(8px)' }}>
                    📅 Events
                  </a>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-white/30">Staff portal:</span>
                  <Link href="/intern/login" className="text-violet-300/80 hover:text-violet-200 transition-colors underline underline-offset-2">Intern</Link>
                  <span className="text-white/15">·</span>
                  <Link href="/supervisor/login" className="text-indigo-300/80 hover:text-indigo-200 transition-colors underline underline-offset-2">Supervisor</Link>
                  <span className="text-white/15">·</span>
                  <Link href="/sign-in" className="text-white/30 hover:text-white/60 transition-colors underline underline-offset-2">Admin</Link>
                </div>
              </div>
            </div>
          </div>

          {/* ── Scroll hint (hidden in signage) ── */}
          {!signage && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 ui-layer">
              <a href="#stats" className="flex flex-col items-center gap-1 text-white/20 hover:text-white/40 transition-colors text-[10px] uppercase tracking-widest">
                Scroll <span className="animate-bounce">↓</span>
              </a>
            </div>
          )}
        </section>

        {/* TICKER */}
        {active.length > 0 && (
          <div className="relative overflow-hidden py-2.5 border-y border-white/[0.05]" style={{ background: 'rgba(7,14,27,.9)' }}>
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest px-4 py-2">LIVE</div>
              <div className="overflow-hidden flex-1 ml-4">
                <div className="ticker flex gap-16 whitespace-nowrap">
                  {[...active, ...active].map((a, i) => (
                    <span key={i} onClick={() => setExpanded(a)} className={`text-sm cursor-pointer hover:opacity-60 transition-opacity ${a.urgent ? 'text-amber-400' : 'text-gray-400'}`}>
                      {a.urgent && '⚠ '}{a.title}<span className="mx-8 text-white/8">|</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STATS */}
        <div id="stats" ref={sRef} className="py-8 px-4 sm:px-6 border-b border-white/[0.04]" style={{ background: 'rgba(255,255,255,.012)' }}>
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
            {[['12','Workstations','text-blue-400'],['100%','Always Free','text-emerald-400'],[`${cLogged}+`,'Logged Today','text-amber-400'],[`${cInterns}`,'Active Interns','text-violet-400']].map(([v,l,c]) => (
              <div key={l} className="gc rounded-xl p-4 sm:p-5 text-center hover:bg-white/[.04] transition-colors">
                <p className={`text-2xl sm:text-3xl font-black ${c} mb-1`}>{v}</p>
                <p className="text-xs text-gray-500 font-medium">{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ABOUT */}
        <section id="about" className="py-16 sm:py-24 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-blue-400 text-[10px] font-black uppercase tracking-[.35em] mb-4">Who We Are</p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4">DICT Digital Technology Center</h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-base leading-relaxed">Bridging the digital divide for Bicolanos through free technology access, e-government services, and digital literacy programs.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="rounded-2xl p-8 border border-blue-500/20" style={{ background: 'linear-gradient(135deg,rgba(59,130,246,.08),rgba(99,102,241,.04))' }}>
                <div className="text-3xl mb-4">🏛️</div>
                <h3 className="text-xl font-bold text-white mb-3">Our Mission</h3>
                <p className="text-gray-400 leading-relaxed text-sm">To provide free, inclusive access to technology and digital services for every Bicolano — regardless of income, age, or background. We leverage public ICT infrastructure to empower citizens.</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {[['Office Hours', fp.office_hours], ['Location', fp.office_location]].map(([l, v]) => (
                    <div key={l} className="gc rounded-xl p-3.5"><p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mb-1">{l}</p><p className="text-white font-semibold text-xs leading-snug">{v}</p></div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {[
                  ['🖥️','Free Computer Access','12 workstations for government transactions, research, and job applications.'],
                  ['📶','High-Speed Internet','Free Wi-Fi and wired access. BYOD-friendly with no time limits.'],
                  ['🏛️','E-Government Assistance','Staff-guided access to SSS, PhilHealth, Pag-IBIG, PhilSys, and more.'],
                  ['📚','Digital Literacy','Regular free workshops on digital skills for all ages.'],
                ].map(([icon, title, desc]) => (
                  <div key={title} className="flex gap-3 items-start gc rounded-xl p-4 hover:bg-white/[.04] transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/10 flex items-center justify-center text-xl flex-shrink-0">{icon}</div>
                    <div><h4 className="font-semibold text-white text-sm mb-0.5">{title}</h4><p className="text-gray-500 text-xs leading-relaxed">{desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SERVICES */}
        <section id="services" className="py-16 sm:py-24 px-4 sm:px-6 border-t border-white/[.04]" style={{ background: 'rgba(255,255,255,.01)' }}>
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-violet-400 text-[10px] font-black uppercase tracking-[.35em] mb-4">What We Offer</p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white">Free Digital Services</h2>
              <p className="text-gray-500 mt-3 max-w-md mx-auto text-sm">Open to all Bicolanos. No registration, no fees.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                ['🖥️','Computer Access','Free workstations for transactions, applications, and research.','Sessions up to 2 hours per visit.'],
                ['📶','Free Internet','High-speed Wi-Fi and wired internet. BYOD welcome.','10–50 Mbps fiber. No time limit on your device.'],
                ['🏛️','E-Government','Guided access to SSS, PhilHealth, Pag-IBIG, PhilSys.','Free form submission and account setup.'],
                ['📚','Digital Literacy','Free workshops for all ages and skill levels.','Regular schedules — check announcements.'],
              ].map(([icon, title, desc, detail]) => (
                <div key={title} className="group gc rounded-2xl p-6 hover:bg-white/[.04] transition-all cursor-default">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/10 flex items-center justify-center text-2xl mb-5">{icon}</div>
                  <h3 className="font-bold text-white text-sm mb-2">{title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
                  <p className="mt-3 pt-3 border-t border-white/5 text-gray-600 text-xs leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* EVENTS */}
        <section id="events" className="py-16 sm:py-24 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-10">
              <p className="text-blue-400 text-[10px] font-black uppercase tracking-[.35em] mb-3">What&apos;s Happening</p>
              <div className="flex items-end justify-between gap-4 flex-wrap">
                <h2 className="text-3xl sm:text-4xl font-black text-white">Events &amp; Announcements</h2>
                <p className="text-gray-600 text-sm">Click any card to read in full.</p>
              </div>
            </div>
            {active.length === 0 ? (
              <div className="text-center py-16 gc rounded-2xl"><p className="text-4xl mb-3">📅</p><p className="text-gray-500 text-sm">No active announcements.</p></div>
            ) : (() => {
              const featured = active.filter(a => a.featured)
              const regular  = active.filter(a => !a.featured)
              const ACCENT: Record<string,{bar:string;badge:string}> = {
                blue:   { bar:'from-blue-500 to-indigo-500',   badge:'bg-blue-500/20 text-blue-300 border-blue-500/20'   },
                amber:  { bar:'from-amber-500 to-yellow-500',  badge:'bg-amber-500/20 text-amber-300 border-amber-500/20' },
                red:    { bar:'from-red-500 to-rose-500',      badge:'bg-red-500/20 text-red-300 border-red-500/20'       },
                green:  { bar:'from-emerald-500 to-green-500', badge:'bg-emerald-500/20 text-emerald-300 border-emerald-500/20' },
                purple: { bar:'from-purple-500 to-violet-500', badge:'bg-purple-500/20 text-purple-300 border-purple-500/20' },
                rose:   { bar:'from-rose-500 to-pink-500',     badge:'bg-rose-500/20 text-rose-300 border-rose-500/20'   },
                teal:   { bar:'from-teal-500 to-cyan-500',     badge:'bg-teal-500/20 text-teal-300 border-teal-500/20'   },
                gray:   { bar:'from-gray-500 to-slate-500',    badge:'bg-gray-500/20 text-gray-300 border-gray-500/20'   },
              }
              return (
                <div className="space-y-6">
                  {/* ── Featured cards ── */}
                  {featured.length > 0 && (
                    <div className={`grid gap-5 ${
                      featured.length === 1 ? 'grid-cols-1 max-w-2xl' :
                      featured.length === 2 ? 'md:grid-cols-2' :
                      'md:grid-cols-2 lg:grid-cols-3'
                    }`}>
                      {featured.slice(0,6).map(a => {
                        const ac = ACCENT[a.highlight||'blue'] || ACCENT.blue
                        return (
                          <div key={a.id} onClick={() => setExpanded(a)}
                            className="group relative rounded-2xl overflow-hidden cursor-pointer shadow-xl hover:shadow-2xl transition-all hover:-translate-y-0.5"
                            style={{ minHeight: 300 }}>
                            {/* Background image or gradient */}
                            {a.imageUrl ? (
                              <img src={a.imageUrl} alt={a.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"/>
                            ) : (
                              <div className={`absolute inset-0 bg-gradient-to-br ${ac.bar} opacity-20`}/>
                            )}
                            {/* Dark overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent"/>
                            {/* Top accent bar */}
                            <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${ac.bar}`}/>
                            {/* Content */}
                            <div className="absolute inset-0 flex flex-col justify-end p-5">
                              <div className="flex items-center gap-2 mb-3">
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${ac.badge}`}>⭐ Featured</span>
                                {a.urgent && <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-red-500/30 text-red-300 border border-red-500/30">⚠ Urgent</span>}
                              </div>
                              <h3 className="font-black text-white text-lg sm:text-xl leading-tight mb-2 group-hover:text-blue-200 transition-colors">{a.title}</h3>
                              <p className="text-white/60 text-xs leading-relaxed line-clamp-2">{a.content}</p>
                              <div className="flex items-center justify-between mt-4">
                                <span className="text-white/40 text-[10px]">{new Date(a.createdAt).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                <span className="text-white/60 text-xs font-semibold group-hover:text-white transition-colors">Read more →</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {/* ── Regular cards ── */}
                  {regular.length > 0 && (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {regular.slice(0,6).map(a => (
                        <div key={a.id} onClick={() => setExpanded(a)} className="group gc rounded-2xl overflow-hidden cursor-pointer hover:bg-white/[.05] transition-all">
                          <div className={`h-1 ${a.urgent ? 'bg-gradient-to-r from-red-500 to-amber-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`} />
                          <div className="p-5">
                            <div className="flex items-center gap-2 mb-3">
                              <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${a.urgent ? 'bg-red-500/20 text-red-400 border border-red-500/20' : 'bg-blue-500/20 text-blue-400 border border-blue-500/20'}`}>{a.urgent ? '⚠ Urgent' : '📌 Notice'}</span>
                              <span className="text-gray-600 text-[10px] ml-auto">{new Date(a.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                            {a.imageUrl && (
                              <div className="rounded-xl overflow-hidden mb-3 -mx-1" style={{height:120}}>
                                <img src={a.imageUrl} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                              </div>
                            )}
                            <h3 className="font-bold text-white text-sm mb-2 group-hover:text-blue-400 transition-colors line-clamp-2">{a.title}</h3>
                            <p className="text-gray-500 text-xs leading-relaxed line-clamp-3">{a.content}</p>
                            <p className="mt-4 text-[10px] font-semibold text-gray-600 group-hover:text-blue-400 transition-colors">Read full notice →</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </section>

        {/* FACEBOOK FEED */}
        {fbPosts.length > 0 && (
          <section className="py-16 sm:py-20 px-4 sm:px-6 border-t border-white/[.04]">
            <div className="max-w-7xl mx-auto">
              <div className="mb-10 flex items-end justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-blue-400 text-[10px] font-black uppercase tracking-[.35em] mb-3">From Our Facebook Page</p>
                  <h2 className="text-3xl sm:text-4xl font-black text-white flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-[#1877F2] flex items-center justify-center text-white font-black text-lg flex-shrink-0">f</span>
                    Latest Updates
                  </h2>
                </div>
                {fbPosts[0]?.permalink_url && (
                  <a href={fbPosts[0].permalink_url.replace(/\/posts\/.*/, '')} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1.5 font-semibold">
                    View all on Facebook →
                  </a>
                )}
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {fbPosts.slice(0, 6).map(post => {
                  const text    = post.message || post.story || ''
                  const dateStr = new Date(post.created_time).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
                  return (
                    <a key={post.id}
                      href={post.permalink_url || `https://www.facebook.com/${post.id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="group gc rounded-2xl overflow-hidden hover:bg-white/[.05] transition-all hover:-translate-y-0.5 hover:shadow-xl flex flex-col">
                      {post.full_picture && (
                        <div className="relative overflow-hidden" style={{height:200}}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={post.full_picture} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/>
                          <div className="absolute top-3 right-3 w-7 h-7 bg-[#1877F2] rounded-lg flex items-center justify-center">
                            <span className="text-white font-black text-sm">f</span>
                          </div>
                        </div>
                      )}
                      <div className="p-5 flex-1 flex flex-col">
                        {!post.full_picture && (
                          <div className="w-7 h-7 bg-[#1877F2] rounded-lg flex items-center justify-center mb-3 flex-shrink-0">
                            <span className="text-white font-black text-sm">f</span>
                          </div>
                        )}
                        <p className="text-gray-300 text-sm leading-relaxed flex-1 line-clamp-4 mb-4">{text}</p>
                        <div className="flex items-center justify-between pt-3 border-t border-white/[.06]">
                          <span className="text-gray-600 text-[11px]">{dateStr}</span>
                          <span className="text-blue-400 text-xs font-semibold group-hover:text-blue-300 transition-colors">View post →</span>
                        </div>
                      </div>
                    </a>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* OFFICES */}
        <section id="offices" className="py-16 sm:py-20 px-4 sm:px-6 border-t border-white/[.04]" style={{ background: 'rgba(255,255,255,.01)' }}>
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-cyan-400 text-[10px] font-black uppercase tracking-[.35em] mb-4">Find Us</p>
              <h2 className="text-3xl sm:text-4xl font-black text-white">DTC Offices in Bicol Region</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                ['Legazpi City, Albay', '2/F Post Telecom Bldg., Lapu Lapu St.', true],
                ['Camarines Sur', 'P. Bustamante Rd., Sto. Domingo, Camaligan', false],
                ['Camarines Norte', 'DICT Bldg., Carlos II Rd., Brgy. III, Daet', false],
                ['Catanduanes', 'Catnet Bldg., San Isidro Village, Virac', false],
                ['Masbate City', 'Post Office Compound, Brgy. Bagumbayan', false],
                ['Sorsogon City', '2/F SNGC Bldg., Flores St., Capitol Compound', false],
              ].map(([loc, addr, hi]) => (
                <div key={loc as string} className={`rounded-xl p-4 border flex gap-3 transition-colors ${hi ? 'border-blue-500/25 bg-blue-500/5' : 'gc hover:bg-white/[.04]'}`}>
                  <span className="text-base flex-shrink-0 mt-0.5">{hi ? '📍' : '🏢'}</span>
                  <div>
                    <p className={`font-bold text-sm mb-0.5 ${hi ? 'text-blue-300' : 'text-white'}`}>{loc as string}{hi && <span className="ml-2 text-[9px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded-full uppercase">This Office</span>}</p>
                    <p className="text-gray-500 text-xs">{addr as string}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 sm:py-20 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-3xl border border-blue-500/15 p-8 sm:p-12 text-center" style={{ background: 'linear-gradient(135deg,rgba(59,130,246,.07),rgba(99,102,241,.03))' }}>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">Ready to visit the DTC?</h2>
              <p className="text-gray-400 text-sm mb-8 max-w-sm mx-auto">Sign in at the logbook on arrival. Free assistance always available.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
                <Link href="/dtc-logbook" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-white text-sm glow transition-all">🖥️ Open the DTC Logbook →</Link>
                <Link href="/intern-logbook" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 gc hover:bg-white/[.06] rounded-xl font-semibold text-gray-300 text-sm transition-all">🎓 Intern Logbook</Link>
              </div>
              <div className="pt-6 border-t border-white/[.06]">
                <p className="text-gray-600 text-[10px] uppercase tracking-widest mb-3 font-semibold">Staff &amp; Intern Portals</p>
                <div className="flex items-center justify-center gap-5 flex-wrap text-sm">
                  <Link href="/intern/login" className="flex items-center gap-1.5 text-violet-400/70 hover:text-violet-300 transition-colors"><span className="w-1.5 h-1.5 rounded-full bg-violet-400/50" />Intern Portal</Link>
                  <span className="text-white/10">·</span>
                  <Link href="/supervisor/login" className="flex items-center gap-1.5 text-indigo-400/70 hover:text-indigo-300 transition-colors"><span className="w-1.5 h-1.5 rounded-full bg-indigo-400/50" />Supervisor Portal</Link>
                  <span className="text-white/10">·</span>
                  <Link href="/sign-in" className="flex items-center gap-1.5 text-gray-600 hover:text-gray-400 transition-colors"><span className="w-1.5 h-1.5 rounded-full bg-gray-500/50" />Admin</Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MOBILE NAV */}
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-white/[.06]" style={{ background: 'rgba(7,14,27,.95)', backdropFilter: 'blur(20px)', paddingBottom: 'env(safe-area-inset-bottom,0px)' }}>
          <div className="grid grid-cols-4 h-14">
            {[['#about','🏛️','About'],['#events','📅','Events'],['/dtc-logbook','🖥️','Logbook'],['/intern/login','🎓','Intern']].map(([href,icon,label]) => (
              <a key={href as string} href={href as string} className="flex flex-col items-center justify-center gap-0.5 text-gray-600 hover:text-gray-300 transition-colors">
                <span className="text-lg leading-none">{icon as string}</span>
                <span className="text-[10px] font-semibold">{label as string}</span>
              </a>
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <footer className="border-t border-white/[.05] py-8 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-8" style={{ background: 'rgba(7,14,27,1)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl glow bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-[10px] font-black">DTC</div>
              <span className="font-bold text-white text-sm">DICT Region V</span>
            </div>
            <p className="text-sm text-gray-600 text-center">&copy; {new Date().getFullYear()} Department of Information and Communications Technology — Bicol Region</p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-600">
              <a href="https://dict.gov.ph" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">dict.gov.ph</a>
              <span className="text-white/10">|</span>
              <Link href="/dtc-logbook" className="hover:text-blue-400 transition-colors">DTC Logbook</Link>
              <span className="text-white/10">|</span>
              <Link href="/intern-logbook" className="hover:text-violet-400 transition-colors">Intern Logbook</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
