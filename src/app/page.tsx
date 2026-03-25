'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type Announcement = {
  id: string
  title: string
  content: string
  urgent: boolean
  createdAt: string
  expiresAt?: string
}

function useCounter(target: number, duration: number, active: boolean) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) return
    const start = performance.now()
    const step = (ts: number) => {
      const progress = Math.min((ts - start) / duration, 1)
      setVal(Math.floor(progress * target))
      if (progress < 1) requestAnimationFrame(step)
      else setVal(target)
    }
    requestAnimationFrame(step)
  }, [target, duration, active])
  return val
}

const DTC_FEATURES = [
  {
    badge: 'WALK-IN',
    accentClass: 'bg-blue-600',
    title: 'Free Computer\nAccess',
    desc: 'Use our 12 public workstations at no cost for government transactions, job applications, and research. No registration needed.',
    stats: [{ val: '12', label: 'Workstations' }, { val: 'Free', label: 'Always' }, { val: '8AM–5PM', label: 'Mon–Fri' }],
    from: 'from-blue-950',
  },
  {
    badge: 'FREE SERVICE',
    accentClass: 'bg-cyan-600',
    title: 'E-Government\nAssistance',
    desc: 'Staff-guided access to SSS, PhilHealth, Pag-IBIG, PhilSys, and other national government portals — all under one roof.',
    stats: [{ val: '10+', label: 'Portals' }, { val: 'Guided', label: 'By Staff' }, { val: 'No Fee', label: 'Always' }],
    from: 'from-cyan-950',
  },
  {
    badge: 'TRAINING',
    accentClass: 'bg-violet-600',
    title: 'Digital Skills\nFor Everyone',
    desc: 'Free workshops and capacity-building sessions on digital literacy — open to all Bicolanos regardless of age or background.',
    stats: [{ val: '50K+', label: 'Served' }, { val: 'All Ages', label: 'Welcome' }, { val: 'Regular', label: 'Schedules' }],
    from: 'from-violet-950',
  },
]

export default function HomePage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [statsActive, setStatsActive] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [expanded, setExpanded] = useState<Announcement | null>(null)
  const [liveTime, setLiveTime] = useState('')
  const [heroIndex, setHeroIndex] = useState(0)
  const [liveStats, setLiveStats] = useState<{ todayCount: number; activeInterns: number; activeNow: number } | null>(null)
  const statsRef = useRef<HTMLElement>(null)

  const active = announcements.filter(a => !a.expiresAt || new Date(a.expiresAt) > new Date())

  const workstations = useCounter(12, 1500, statsActive)

  useEffect(() => {
    fetch('/api/announcements').then(r => r.json()).then(d => { if (Array.isArray(d)) setAnnouncements(d) }).catch(() => {})
  }, [])

  useEffect(() => {
    const fetchLive = () =>
      fetch('/api/stats/live').then(r => r.json()).then(d => {
        if (d && typeof d.todayCount === 'number') setLiveStats({ todayCount: d.todayCount, activeInterns: d.activeInterns ?? 0, activeNow: d.activeNow ?? 0 })
      }).catch(() => {})
    fetchLive()
    const t = setInterval(fetchLive, 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!statsRef.current) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStatsActive(true); obs.disconnect() } }, { threshold: 0.3 })
    obs.observe(statsRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const tick = () => setLiveTime(new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(null) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  useEffect(() => {
    if (DTC_FEATURES.length <= 1) return
    const t = setInterval(() => setHeroIndex(i => (i + 1) % DTC_FEATURES.length), 5000)
    return () => clearInterval(t)
  }, [])

  const now    = new Date()
  const day    = now.getDay()
  const hour   = now.getHours() + now.getMinutes() / 60
  const isOpen = day >= 1 && day <= 5 && hour >= 8 && hour < 17
  const feat   = DTC_FEATURES[heroIndex]

  return (
    <>
      <style>{`
        @keyframes ticker { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }
        @keyframes modalIn { from { opacity: 0; transform: scale(.96) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        @keyframes scanLine { 0% { transform: translateY(-100%) } 100% { transform: translateY(100vh) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        .ticker { animation: ticker 35s linear infinite }
        .modal-anim { animation: modalIn .2s ease both }
        .scan { animation: scanLine 12s linear infinite }
        .fade-up { animation: fadeUp .35s ease both }
        html { scroll-behavior: smooth }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 0px) }
        .pt-safe { padding-top: env(safe-area-inset-top, 0px) }
      `}</style>

      {/* ── Announcement Expand Modal ── */}
      {expanded && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setExpanded(null)}>
          <div className="modal-anim bg-gray-800 border border-gray-700 rounded-3xl w-full max-w-lg max-h-[85dvh] overflow-y-auto p-6 sm:p-8 relative shadow-2xl" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setExpanded(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-white transition-all text-sm">&times;</button>
            <div className="mb-5">
              <span className={`text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full ${expanded.urgent ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                {expanded.urgent ? '🔴 Urgent Notice' : '📌 Announcement'}
              </span>
            </div>
            <h2 className="font-black text-white text-xl leading-snug mb-3">{expanded.title}</h2>
            <p className="text-gray-500 text-xs mb-6">
              Posted {new Date(expanded.createdAt).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              {expanded.expiresAt && <span className="text-amber-500/80"> &middot; Ends {new Date(expanded.expiresAt).toLocaleDateString('en-PH', { month: 'long', day: 'numeric' })}</span>}
            </p>
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{expanded.content}</p>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-900 text-white">

        {/* ════════════════════════ NAV ════════════════════════ */}
        <nav className="fixed top-0 inset-x-0 z-40 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[11px] font-black text-white">DTC</div>
              <span className="font-bold text-white text-[15px] leading-none">DICT Region V</span>
            </div>

            <div className="hidden md:flex items-center gap-6 text-sm">
              {[['#about','About'],['#events','Events'],['#services','Services']].map(([h,l]) => (
                <a key={h} href={h} className="text-gray-400 hover:text-white transition-colors">{l}</a>
              ))}
              <Link href="/intern-logbook" className="text-gray-400 hover:text-violet-400 transition-colors">Interns</Link>
              <Link href="/dtc-logbook" className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-white transition-colors text-sm">
                Logbook
              </Link>
            </div>

            <button onClick={() => setMenuOpen(o => !o)} className="md:hidden text-gray-400 p-2 text-xl">
              {menuOpen ? '\u2715' : '\u2630'}
            </button>
          </div>

          {menuOpen && (
            <div className="md:hidden border-t border-gray-800 px-4 py-4 bg-gray-900/98 space-y-3">
              {[['#about','About'],['#events','Events'],['#services','Services']].map(([h,l]) => (
                <a key={h} href={h} onClick={() => setMenuOpen(false)} className="block text-gray-300 text-sm py-1.5">{l}</a>
              ))}
              <Link href="/intern-logbook" onClick={() => setMenuOpen(false)} className="block text-violet-400 text-sm py-1.5">
                🎓 Intern Logbook
              </Link>
              <Link href="/dtc-logbook" onClick={() => setMenuOpen(false)} className="block text-center py-2.5 bg-blue-600 rounded-lg text-sm font-bold mt-2">
                🖥️ DTC Logbook
              </Link>
            </div>
          )}
        </nav>

        {/* ════════════════════════ HERO ════════════════════════ */}
        <section className={`h-[100dvh] w-full relative pt-14 bg-gradient-to-br ${feat.from} via-gray-900 to-gray-900 transition-all duration-700`}>
          {/* Grid overlay */}
          <div className="absolute inset-0 opacity-[0.035]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.2) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.2) 1px,transparent 1px)', backgroundSize: '64px 64px' }} />
          {/* Scan line */}
          <div className="scan absolute inset-x-0 h-px opacity-[0.06]"
            style={{ background: 'linear-gradient(90deg,transparent,rgba(99,102,241,.9),transparent)' }} />
          {/* Left-to-right fade overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />

          <div className="relative z-10 h-full flex items-center">
            <div className="max-w-7xl mx-auto px-6 sm:px-10 w-full">
              <div className="max-w-2xl">

                {/* Top badge row */}
                <div className="flex items-center gap-3 mb-5 sm:mb-7 flex-wrap">
                  <span className={`${feat.accentClass} text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full`}>
                    {feat.badge}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className={`absolute inset-0 rounded-full ${isOpen ? 'bg-green-400' : 'bg-red-400'} opacity-70 animate-ping`} />
                      <span className={`relative inline-flex h-2 w-2 rounded-full ${isOpen ? 'bg-green-400' : 'bg-red-400'}`} />
                    </span>
                    <span className="text-gray-400 text-xs">{isOpen ? 'Open Now \u00b7 Mon\u2013Fri 8AM\u20135PM' : 'Closed \u00b7 Opens Mon\u2013Fri 8AM'}</span>
                    {liveTime && <span className="text-gray-600 text-[10px] font-mono pl-2.5 border-l border-gray-700 hidden sm:block">{liveTime}</span>}
                  </div>
                </div>

                {/* Title */}
                <h1 className="text-[2.4rem] sm:text-5xl md:text-6xl lg:text-7xl font-black text-white mb-5 sm:mb-6 leading-[1.1] fade-up" style={{ whiteSpace: 'pre-line' }}>
                  {feat.title}
                </h1>

                {/* Description */}
                <p className="text-base sm:text-lg text-gray-300 mb-7 sm:mb-9 leading-relaxed max-w-xl">
                  {feat.desc}
                </p>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4 sm:gap-8 mb-7 sm:mb-10">
                  {feat.stats.map(s => (
                    <div key={s.label}>
                      <div className="text-2xl font-black text-white">{s.val}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
                  <Link href="/dtc-logbook"
                    className="flex items-center justify-center gap-2.5 px-6 py-3.5 sm:py-3 bg-blue-600 active:bg-blue-700 hover:bg-blue-700 rounded-xl font-bold text-white transition-colors">
                    🖥️ Access Logbook <span className="text-blue-300 ml-0.5">&rarr;</span>
                  </Link>
                  <Link href="/intern-logbook"
                    className="flex items-center justify-center gap-2.5 px-6 py-3.5 sm:py-3 bg-white/10 active:bg-white/20 hover:bg-white/15 border border-white/15 rounded-xl font-semibold text-gray-200 transition-colors">
                    🎓 Intern Logbook
                  </Link>
                  <a href="#events"
                    className="flex items-center justify-center gap-2.5 px-6 py-3.5 sm:py-3 bg-white/10 active:bg-white/20 hover:bg-white/15 border border-white/15 rounded-xl font-semibold text-gray-200 transition-colors">
                    📅 Events
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Carousel dots */}
          <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {DTC_FEATURES.map((_, i) => (
              <button key={i} onClick={() => setHeroIndex(i)}
                className={`h-2 rounded-full transition-all duration-300 touch-manipulation ${i === heroIndex ? 'bg-blue-500 w-8' : 'bg-gray-600 hover:bg-gray-500 w-2'}`}
                style={{ minWidth: '1.25rem', minHeight: '2rem', display: 'flex', alignItems: 'center' }} />
            ))}
          </div>
        </section>

        {/* ════════════════════════ TICKER ════════════════════════ */}
        {active.length > 0 && (
          <div className="relative overflow-hidden py-3 border-y border-gray-800 bg-gray-950">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 z-10">LIVE</div>
              <div className="overflow-hidden flex-1 ml-4">
                <div className="ticker flex gap-20 whitespace-nowrap">
                  {[...active, ...active].map((a, i) => (
                    <span key={i} onClick={() => setExpanded(a)}
                      className={`text-sm cursor-pointer hover:opacity-70 transition-opacity ${a.urgent ? 'text-amber-400' : 'text-gray-400'}`}>
                      {a.urgent && <span className="text-red-400 mr-1">🔴</span>}{a.title}
                      <span className="mx-8 text-gray-700">|</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}


        {/* ════════════════════════ ABOUT ════════════════════════ */}
        <section id="about" className="py-14 sm:py-20 px-4 sm:px-6 bg-gradient-to-b from-gray-950 to-gray-900">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-10 sm:mb-14">
              <p className="text-blue-400 text-xs font-black uppercase tracking-[0.3em] mb-4">Who We Are</p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white">DICT Digital Technology Center</h2>
              <p className="text-base sm:text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mt-4">
                Bridging the digital divide for Bicolanos through free technology access, e-government services, and digital literacy programs in Legazpi City.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 md:gap-10 items-start mb-10 sm:mb-14">
              {/* Mission card */}
              <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/10 rounded-2xl p-8 border border-blue-600/20 h-full">
                <div className="text-3xl mb-5">🏛️</div>
                <h3 className="text-2xl font-bold text-white mb-4">Our Mission</h3>
                <p className="text-gray-300 leading-relaxed">
                  To provide free, inclusive access to technology and digital services for every Bicolano — regardless of income, age, or background. We leverage public ICT infrastructure to empower citizens through connected governance and lifelong digital skills.
                </p>
                <div className="mt-8 grid grid-cols-2 gap-4">
                  {[
                    { label: 'Service Hours', val: 'Mon–Fri\n8AM–5PM' },
                    { label: 'Location',      val: 'Legazpi City\nAlbay, Bicol' },
                  ].map(s => (
                    <div key={s.label} className="bg-white/5 rounded-xl p-4">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-1">{s.label}</p>
                      <p className="text-white font-semibold text-sm" style={{ whiteSpace: 'pre-line' }}>{s.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Features list */}
              <div className="space-y-5">
                {[
                  { icon: '🖥️', color: 'bg-blue-600/20',   title: 'Free Computer Access',    desc: '12 workstations open to the public for government transactions, research, and job applications.' },
                  { icon: '📶', color: 'bg-violet-600/20', title: 'High-Speed Internet',     desc: 'Free Wi-Fi and wired connection. BYOD-friendly — bring your own device with no time limits.' },
                  { icon: '🏛️', color: 'bg-cyan-600/20',   title: 'E-Government Assistance', desc: 'Staff-guided access to SSS, PhilHealth, Pag-IBIG, PhilSys, and other government portals.' },
                  { icon: '📚', color: 'bg-amber-600/20',  title: 'Digital Literacy',        desc: 'Regular free workshops on digital skills — from basic computing to online services — for all ages.' },
                ].map(f => (
                  <div key={f.title} className="flex gap-4 items-start bg-gray-800/40 rounded-xl p-5 border border-gray-700 hover:border-gray-600 transition-colors">
                    <div className={`w-11 h-11 rounded-xl ${f.color} flex items-center justify-center flex-shrink-0 text-xl`}>{f.icon}</div>
                    <div>
                      <h4 className="font-semibold text-white mb-1">{f.title}</h4>
                      <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats strip */}
            <div ref={statsRef as React.RefObject<HTMLDivElement>} className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {[
                { val: workstations,                  suffix: '',   label: 'Workstations',    color: 'text-cyan-400'    },
                { val: 100,                             suffix: '%',  label: 'Free of Charge',  color: 'text-emerald-400' },
                { val: liveStats?.todayCount  ?? 0,     suffix: '+',  label: 'Logged Today',    color: 'text-amber-400'   },
                { val: liveStats?.activeInterns ?? 0,   suffix: '',   label: 'Active Interns',  color: 'text-violet-400'  },
              ].map(s => (
                <div key={s.label} className="bg-gray-800/50 rounded-xl p-4 sm:p-5 text-center border border-gray-700 hover:border-gray-600 transition-colors">
                  <div className={`text-2xl sm:text-3xl font-black ${s.color} mb-1`}>{s.val.toLocaleString()}{s.suffix}</div>
                  <div className="text-xs text-gray-400">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════ SERVICES ════════════════════════ */}
        <section id="services" className="py-14 sm:py-20 px-4 sm:px-6 bg-gray-950">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <p className="text-violet-400 text-xs font-black uppercase tracking-[0.3em] mb-4">What We Offer</p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white">Free Digital Services</h2>
              <p className="text-gray-400 mt-4 max-w-xl mx-auto text-sm leading-relaxed">
                Open to all Bicolanos. No registration fees, no barriers — just access to the digital world.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
              {[
                { icon: '🖥️', title: 'Computer Access',    desc: 'Free workstations for government transactions, job applications, and research.',       detail: 'Sessions up to 2 hours per visit. Staff assistance is always available.',        from: 'from-blue-600/15',   border: 'border-blue-600/20 hover:border-blue-500/40'   },
                { icon: '📶', title: 'Free Internet',       desc: 'High-speed Wi-Fi and wired internet. Bring your device or use ours — always free.',   detail: '10–50 Mbps fiber connection. BYOD users enjoy unlimited session time.',          from: 'from-violet-600/15', border: 'border-violet-600/20 hover:border-violet-500/40' },
                { icon: '🏛️', title: 'E-Government',        desc: 'Guided access to SSS, PhilHealth, Pag-IBIG, PhilSys, and other national portals.',    detail: 'Staff help with account setup and online form submission at no charge.',         from: 'from-cyan-600/15',   border: 'border-cyan-600/20 hover:border-cyan-500/40'   },
                { icon: '📚', title: 'Digital Literacy',   desc: 'Free trainings, workshops, and capacity-building sessions for all ages.',               detail: 'Check the announcements section for the next training schedule.',                from: 'from-amber-600/15',  border: 'border-amber-600/20 hover:border-amber-500/40'  },
              ].map(s => (
                <div key={s.title} className={`group rounded-xl p-6 bg-gradient-to-br ${s.from} to-transparent border ${s.border} transition-all cursor-default`}>
                  <div className="text-3xl mb-4">{s.icon}</div>
                  <h3 className="font-bold text-white mb-2">{s.title}</h3>
                  <p className="text-gray-400 text-xs leading-relaxed">{s.desc}</p>
                  <p className="mt-3 pt-3 border-t border-white/5 text-gray-600 text-[11px] leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-300">{s.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════ OFFICES ════════════════════════ */}
        <section className="py-14 sm:py-16 px-4 sm:px-6 bg-gray-900">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8 sm:mb-10">
              <p className="text-cyan-400 text-xs font-black uppercase tracking-[0.3em] mb-4">Find Us</p>
              <h2 className="text-3xl sm:text-4xl font-black text-white">DTC Offices in Bicol Region</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { loc: 'Legazpi City, Albay',  addr: '2/F Post Telecom Bldg., Lapu Lapu St.', highlight: true },
                { loc: 'Camarines Sur',         addr: 'P. Bustamante Rd., Sto. Domingo, Camaligan' },
                { loc: 'Camarines Norte',       addr: 'DICT Bldg., Carlos II Rd., Brgy. III, Daet' },
                { loc: 'Catanduanes',           addr: 'Catnet Bldg., San Isidro Village, Virac' },
                { loc: 'Masbate City',          addr: 'Post Office Compound, Brgy. Bagumbayan' },
                { loc: 'Sorsogon City',         addr: '2/F SNGC Bldg., Flores St., Capitol Compound' },
              ].map(o => (
                <div key={o.loc} className={`rounded-xl p-5 border transition-colors ${
                  o.highlight
                    ? 'bg-blue-600/15 border-blue-600/30 hover:border-blue-500/50'
                    : 'bg-gray-800/40 border-gray-700 hover:border-gray-600'
                }`}>
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0 mt-0.5">📍</span>
                    <div>
                      <p className={`font-bold text-sm mb-1 ${o.highlight ? 'text-blue-300' : 'text-white'}`}>
                        {o.loc}{o.highlight && <span className="ml-2 text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">This Office</span>}
                      </p>
                      <p className="text-gray-400 text-xs leading-relaxed">{o.addr}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════ EVENTS ════════════════════════ */}
        <section id="events" className="py-14 sm:py-20 px-4 sm:px-6 bg-gray-950">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 sm:mb-12">
              <p className="text-blue-400 text-xs font-black uppercase tracking-[0.3em] mb-4">What&apos;s Happening</p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white">Events &amp; Announcements</h2>
              <p className="text-gray-400 mt-3 text-sm">
                Stay informed on the latest happenings, trainings, and official notices.
                <span className="text-gray-600 ml-2">Click any card to read in full.</span>
              </p>
            </div>

            {active.length === 0 ? (
              <div className="text-center py-16 bg-gray-800/50 rounded-xl border border-gray-700">
                <p className="text-4xl mb-3">📅</p>
                <p className="text-gray-400">No active announcements. Check back soon.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {active.slice(0, 6).map(a => (
                  <div key={a.id} onClick={() => setExpanded(a)}
                    className="group bg-gray-800/50 rounded-xl overflow-hidden border border-gray-700 hover:border-blue-500/50 transition-all cursor-pointer">
                    {/* Accent band */}
                    <div className={`h-1 w-full ${a.urgent ? 'bg-gradient-to-r from-red-500 to-amber-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`} />
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${a.urgent ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                          {a.urgent ? '🔴 Urgent' : '📌 Notice'}
                        </span>
                        <span className="text-gray-600 text-xs ml-auto">
                          {new Date(a.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <h3 className="font-bold text-white mb-2 group-hover:text-blue-400 transition-colors line-clamp-2">{a.title}</h3>
                      <p className="text-gray-400 text-xs leading-relaxed line-clamp-3">{a.content}</p>
                      {a.expiresAt && (
                        <p className="mt-3 text-amber-500/70 text-[10px] font-medium">
                          Ends {new Date(a.expiresAt).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                      <div className="mt-4 flex items-center gap-1 text-[10px] font-semibold text-gray-600 group-hover:text-blue-400 transition-colors">
                        Read full notice <span className="group-hover:translate-x-0.5 transition-transform inline-block">&rarr;</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ════════════════════════ CTA ════════════════════════ */}
        <section className="py-14 sm:py-20 px-4 sm:px-6 bg-gray-950">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Ready to visit the DTC?</h2>
            <p className="text-gray-400 text-base mb-8">
              Sign in at the logbook when you arrive. Our staff will guide you through every service — free of charge.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/dtc-logbook"
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-white transition-colors text-base">
                🖥️ Open the DTC Logbook <span className="text-blue-300">&rarr;</span>
              </Link>
              <Link href="/intern-logbook"
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl font-semibold text-gray-200 transition-colors text-base">
                🎓 Intern Logbook
              </Link>
            </div>
          </div>
        </section>

        {/* ════════════════════════ MOBILE BOTTOM NAV ════════════════════════ */}
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="grid grid-cols-4 h-14">
            {[
              { href: '#about',          icon: '🏛️', label: 'About'   },
              { href: '#events',         icon: '📅', label: 'Events'  },
              { href: '/dtc-logbook',    icon: '🖥️', label: 'Logbook' },
              { href: '/intern-logbook', icon: '🎓', label: 'Interns' },
            ].map(({ href, icon, label }) => (
              <a key={href} href={href}
                className="flex flex-col items-center justify-center gap-0.5 text-gray-500 active:text-blue-400 hover:text-gray-300 transition-colors">
                <span className="text-lg leading-none">{icon}</span>
                <span className="text-[10px] font-semibold">{label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* ════════════════════════ FOOTER ════════════════════════ */}
        <footer className="bg-gray-950 py-8 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-8 border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[11px] font-black text-white">DTC</div>
              <span className="font-bold text-white">DICT Region V</span>
            </div>
            <p className="text-sm text-gray-500 text-center">
              &copy; {new Date().getFullYear()} Department of Information and Communications Technology &mdash; Bicol Region
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
              <a href="https://dict.gov.ph" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">dict.gov.ph</a>
              <span className="text-gray-800">|</span>
              <Link href="/dtc-logbook"    className="hover:text-blue-400 transition-colors">DTC Logbook</Link>
              <span className="text-gray-800">|</span>
              <Link href="/intern-logbook" className="hover:text-violet-400 transition-colors">Intern Logbook</Link>
            </div>
          </div>
        </footer>

      </div>
    </>
  )
}
