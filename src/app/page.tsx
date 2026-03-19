'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

type Announcement = {
  id: string
  title: string
  content: string
  createdAt: string
  expiresAt?: string | null
  urgent: boolean
}

function useCounter(target: number, duration = 2200, active = false) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) return
    let start: number | null = null
    const step = (ts: number) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      setVal(Math.floor(progress * target))
      if (progress < 1) requestAnimationFrame(step)
      else setVal(target)
    }
    requestAnimationFrame(step)
  }, [target, duration, active])
  return val
}

function EventCard({ a }: { a: Announcement }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.1 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }}
      className="group relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-1 cursor-default">
      <div className={`absolute top-0 left-0 w-1 h-full ${a.urgent ? 'bg-amber-400' : 'bg-blue-500'}`}/>
      <div className="p-6 pl-7">
        <div className="flex items-start justify-between gap-3 mb-3">
          <span className={`text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full ${
            a.urgent ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          }`}>
            {a.urgent ? 'ðŸ”´ Urgent' : 'ðŸ“Œ Notice'}
          </span>
          <span className="text-gray-600 text-xs flex-shrink-0">
            {new Date(a.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <h3 className="font-bold text-white text-sm leading-snug mb-2">{a.title}</h3>
        <p className="text-gray-400 text-xs leading-relaxed line-clamp-3">{a.content}</p>
        {a.expiresAt && (
          <p className="mt-3 text-amber-500/70 text-[10px] font-medium">
            Ends {new Date(a.expiresAt).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>
    </div>
  )
}

export default function HomePage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [statsActive, setStatsActive] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const statsRef = useRef<HTMLElement>(null)

  const active = announcements.filter(a => !a.expiresAt || new Date(a.expiresAt) > new Date())

  const visitors  = useCounter(50000, 2400, statsActive)
  const daily     = useCounter(250, 2000, statsActive)
  const workstations = useCounter(12, 1500, statsActive)

  useEffect(() => {
    fetch('/api/announcements').then(r => r.json()).then(d => { if (Array.isArray(d)) setAnnouncements(d) }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!statsRef.current) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStatsActive(true); obs.disconnect() } }, { threshold: 0.3 })
    obs.observe(statsRef.current)
    return () => obs.disconnect()
  }, [])

  // Determine live office status (Monâ€“Fri 8AMâ€“5PM)
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours() + now.getMinutes() / 60
  const isOpen = day >= 1 && day <= 5 && hour >= 8 && hour < 17

  return (
    <>
      <style>{`
        @keyframes aur1{0%,100%{transform:translate(-8%,-12%) scale(1) rotate(0deg);opacity:.55}40%{transform:translate(6%,8%) scale(1.15) rotate(25deg);opacity:.75}75%{transform:translate(-4%,12%) scale(.95) rotate(-10deg);opacity:.5}}
        @keyframes aur2{0%,100%{transform:translate(12%,6%) scale(1) rotate(0deg);opacity:.45}35%{transform:translate(-6%,-10%) scale(1.1) rotate(-30deg);opacity:.65}70%{transform:translate(10%,-4%) scale(.92) rotate(18deg);opacity:.55}}
        @keyframes aur3{0%,100%{transform:translate(0,0) scale(1);opacity:.35}50%{transform:translate(-12%,14%) scale(1.2) rotate(45deg);opacity:.6}}
        @keyframes floatA{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-18px) rotate(6deg)}}
        @keyframes floatB{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-12px) rotate(-5deg)}}
        @keyframes floatC{0%,100%{transform:translateY(0) rotate(12deg)}50%{transform:translateY(-22px) rotate(18deg)}}
        @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes scanLine{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
        @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes pulseRing{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.2);opacity:0}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glow{0%,100%{box-shadow:0 0 20px rgba(99,102,241,.4)}50%{box-shadow:0 0 50px rgba(99,102,241,.8)}}
        @keyframes borderSpin{0%{background-position:0% 50%}100%{background-position:200% 50%}}
        .aur1{animation:aur1 20s ease-in-out infinite}
        .aur2{animation:aur2 26s ease-in-out infinite}
        .aur3{animation:aur3 32s ease-in-out infinite}
        .floatA{animation:floatA 7s ease-in-out infinite}
        .floatB{animation:floatB 9s ease-in-out infinite}
        .floatC{animation:floatC 11s ease-in-out infinite}
        .shimmer-text{background:linear-gradient(100deg,#60a5fa 0%,#a78bfa 30%,#f472b6 60%,#60a5fa 100%);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 5s linear infinite}
        .scan{animation:scanLine 10s linear infinite}
        .ticker{animation:ticker 35s linear infinite}
        .nav-glass{background:rgba(5,8,20,.75);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-bottom:1px solid rgba(255,255,255,.07)}
        .glass{background:rgba(255,255,255,.04);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.08)}
        .cta-primary{background:linear-gradient(135deg,#3b82f6,#6366f1);animation:glow 3s ease-in-out infinite;transition:transform .2s ease,filter .2s ease}
        .cta-primary:hover{transform:translateY(-2px) scale(1.02);filter:brightness(1.15)}
        .cta-secondary{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);transition:background .2s,transform .2s}
        .cta-secondary:hover{background:rgba(255,255,255,.12);transform:translateY(-2px)}
        .fadeup-1{animation:fadeUp .8s .1s both}
        .fadeup-2{animation:fadeUp .8s .25s both}
        .fadeup-3{animation:fadeUp .8s .4s both}
        .fadeup-4{animation:fadeUp .8s .55s both}
        .fadeup-5{animation:fadeUp .8s .7s both}
        .stat-card{background:linear-gradient(135deg,rgba(255,255,255,.06) 0%,rgba(255,255,255,.02) 100%);border:1px solid rgba(255,255,255,.1);transition:transform .3s,border-color .3s}
        .stat-card:hover{transform:translateY(-4px);border-color:rgba(99,102,241,.4)}
        .service-card{border:1px solid rgba(255,255,255,.07);transition:transform .3s,box-shadow .3s,border-color .3s}
        .service-card:hover{transform:translateY(-6px);box-shadow:0 24px 64px rgba(0,0,0,.4);border-color:rgba(99,102,241,.35)}
        html{scroll-behavior:smooth}
      `}</style>

      <div className="min-h-screen bg-[#060810] text-white overflow-x-hidden font-sans">

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• NAV â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <nav className="nav-glass fixed top-0 inset-x-0 z-50">
          <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 blur-sm opacity-70"/>
                <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[11px] font-black text-white">DTC</div>
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-none">DICT Region V</p>
                <p className="text-blue-400 text-[10px] font-medium">Digital Technology Center</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-8 text-sm">
              {[['#events','Events'],['#services','Services'],['#about','About']].map(([h,l]) => (
                <a key={h} href={h} className="text-gray-400 hover:text-white transition-colors duration-200 font-medium">{l}</a>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Link href="/dtc-logbook" className="cta-primary hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white">
                <span>ðŸ–¥ï¸</span> Logbook
              </Link>
              <button onClick={() => setMenuOpen(o => !o)} className="md:hidden text-gray-400 p-2">
                {menuOpen ? 'âœ•' : 'â˜°'}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {menuOpen && (
            <div className="md:hidden border-t border-white/5 px-5 py-4 space-y-3 bg-[#060810]/95">
              {[['#events','ðŸ“… Events'],['#services','âš¡ Services'],['#about','â„¹ï¸ About']].map(([h,l]) => (
                <a key={h} href={h} onClick={() => setMenuOpen(false)} className="block text-gray-300 hover:text-white py-1.5 text-sm">{l}</a>
              ))}
              <Link href="/dtc-logbook" onClick={() => setMenuOpen(false)} className="block mt-2 cta-primary text-center py-3 rounded-xl text-sm font-bold">ðŸ–¥ï¸ Access Logbook</Link>
            </div>
          )}
        </nav>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• HERO â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">

          {/* Aurora bg orbs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="aur1 absolute w-[90vw] h-[90vw] max-w-[900px] max-h-[900px] rounded-full blur-[140px]"
              style={{background:'radial-gradient(circle,rgba(59,130,246,.35) 0%,transparent 65%)',top:'-30%',left:'-25%'}}/>
            <div className="aur2 absolute w-[75vw] h-[75vw] max-w-[750px] max-h-[750px] rounded-full blur-[120px]"
              style={{background:'radial-gradient(circle,rgba(139,92,246,.3) 0%,transparent 65%)',top:'15%',right:'-20%'}}/>
            <div className="aur3 absolute w-[65vw] h-[65vw] max-w-[650px] max-h-[650px] rounded-full blur-[150px]"
              style={{background:'radial-gradient(circle,rgba(6,182,212,.22) 0%,transparent 65%)',bottom:'-15%',left:'15%'}}/>
            {/* Subtle grid */}
            <div className="absolute inset-0 opacity-[0.035]"
              style={{backgroundImage:'linear-gradient(rgba(255,255,255,.15) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.15) 1px,transparent 1px)',backgroundSize:'64px 64px'}}/>
            {/* Scan line */}
            <div className="scan absolute inset-x-0 h-px opacity-[0.08]"
              style={{background:'linear-gradient(90deg,transparent,rgba(99,102,241,.9),transparent)'}}/>
          </div>

          {/* Floating decorative shapes */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="floatA absolute top-1/4 right-[8%] w-28 h-28 opacity-[0.12]">
              <div className="w-full h-full rounded-3xl border-2 border-blue-400 rotate-12"/>
            </div>
            <div className="floatB absolute bottom-1/3 left-[6%] w-20 h-20 opacity-[0.1]">
              <div className="w-full h-full rounded-full border border-violet-400"/>
            </div>
            <div className="floatC absolute top-[35%] left-[14%] w-12 h-12 opacity-[0.15]">
              <div className="w-full h-full rounded-xl border border-cyan-400"/>
            </div>
            <div className="floatA absolute top-[20%] right-[22%] w-5 h-5 opacity-40 bg-blue-400 rounded-full blur-sm" style={{animationDelay:'-4s'}}/>
            <div className="floatB absolute bottom-[25%] right-[12%] w-3 h-3 opacity-50 bg-violet-400 rounded-full blur-sm" style={{animationDelay:'-2s'}}/>
            <div className="floatC absolute top-[60%] left-[30%] w-2 h-2 opacity-60 bg-cyan-400 rounded-full blur-sm" style={{animationDelay:'-6s'}}/>
          </div>

          {/* Hero content */}
          <div className="relative z-10 text-center max-w-5xl mx-auto px-6 py-20">

            {/* Status badge */}
            <div className="fadeup-1 inline-flex items-center gap-2.5 mb-8 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`absolute inset-0 rounded-full ${isOpen ? 'bg-green-400' : 'bg-red-400'} opacity-75 animate-ping`}/>
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isOpen ? 'bg-green-400' : 'bg-red-400'}`}/>
              </span>
              <span className="text-xs font-semibold text-gray-300">
                {isOpen ? 'DTC is Open Now  Â·  Monâ€“Fri  8AM â€“ 5PM' : 'Closed Â· Opens Monâ€“Fri 8AM'}
              </span>
            </div>

            {/* Main headline */}
            <h1 className="fadeup-2 text-5xl sm:text-6xl md:text-8xl font-black tracking-tight leading-none mb-6">
              <span className="text-white block">Department of</span>
              <span className="shimmer-text block mt-1">Information &amp;</span>
              <span className="text-white block mt-1">Communications</span>
              <span className="text-white/40 block text-3xl sm:text-4xl md:text-5xl mt-3 font-bold tracking-widest uppercase">Technology  Â·  Region V</span>
            </h1>

            {/* Tagline */}
            <p className="fadeup-3 text-base sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-10">
              Empowering Bicolanos through digital inclusion â€” free internet access, government e-services, and public workstations at the DICT DTC, Legazpi City.
            </p>

            {/* CTA buttons */}
            <div className="fadeup-4 flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link href="/dtc-logbook" className="cta-primary flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-white text-base">
                <span className="text-xl">ðŸ–¥ï¸</span>
                <span>Access the Logbook</span>
                <span className="text-blue-200 text-lg">â†’</span>
              </Link>
              <a href="#events" className="cta-secondary flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-gray-300 text-base">
                <span className="text-xl">ðŸ“…</span>
                <span>View Events</span>
              </a>
            </div>

            {/* Scroll cue */}
            <div className="fadeup-5 flex flex-col items-center gap-2 opacity-30">
              <span className="text-xs tracking-widest uppercase text-gray-500">Scroll</span>
              <div className="w-px h-10 bg-gradient-to-b from-white/30 to-transparent"/>
            </div>
          </div>
        </section>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• TICKER â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {active.length > 0 && (
          <div className="relative overflow-hidden py-3.5 border-y border-white/5 bg-white/[0.02]">
            <div className="flex items-center">
              <div className="flex-shrink-0 z-10 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 mr-0">
                LIVE
              </div>
              <div className="overflow-hidden flex-1 ml-4">
                <div className="ticker flex gap-20 whitespace-nowrap">
                  {[...active, ...active].map((a, i) => (
                    <span key={i} className={`text-sm font-medium ${a.urgent ? 'text-amber-400' : 'text-gray-400'}`}>
                      {a.urgent && <span className="text-amber-500 mr-1">ðŸ”´</span>}{a.title}
                      <span className="mx-8 text-white/10">|</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• EVENTS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <section id="events" className="py-28 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-blue-400 text-xs font-black uppercase tracking-[0.3em] mb-4">What&apos;s Happening</p>
              <h2 className="text-4xl md:text-5xl font-black text-white">Events &amp; Announcements</h2>
              <p className="text-gray-500 mt-4 max-w-xl mx-auto text-sm leading-relaxed">
                Stay informed on the latest happenings, trainings, and official notices from DICT Region V.
              </p>
            </div>

            {active.length === 0 ? (
              <div className="glass rounded-3xl p-20 text-center max-w-md mx-auto">
                <div className="text-6xl mb-5">ðŸ“…</div>
                <p className="text-white font-bold text-xl mb-2">No upcoming events</p>
                <p className="text-gray-500 text-sm">Check back soon â€” new events and announcements will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {active.slice(0, 6).map(a => <EventCard key={a.id} a={a} />)}
              </div>
            )}
          </div>
        </section>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• SERVICES â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <section id="services" className="py-28 px-6 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0"
            style={{background:'radial-gradient(ellipse at 50% 60%,rgba(139,92,246,.12) 0%,transparent 70%)'}}/>
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <p className="text-violet-400 text-xs font-black uppercase tracking-[0.3em] mb-4">What We Offer</p>
              <h2 className="text-4xl md:text-5xl font-black text-white">Free Digital Services</h2>
              <p className="text-gray-500 mt-4 max-w-xl mx-auto text-sm leading-relaxed">
                Open to all Bicolanos. No fees, no barriers â€” just access to the digital world.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { icon:'ðŸ–¥ï¸', title:'Computer Access', desc:'Free use of DTC workstations for government transactions, job applications, and research.', grad:'from-blue-500/15 to-blue-600/5', glow:'group-hover:shadow-blue-500/20' },
                { icon:'ðŸ“¶', title:'Free Internet', desc:'High-speed Wi-Fi and wired internet. Bring your own device or use ours â€” always free.', grad:'from-violet-500/15 to-violet-600/5', glow:'group-hover:shadow-violet-500/20' },
                { icon:'ðŸ›ï¸', title:'E-Government', desc:'Guided access to SSS, PhilHealth, Pag-IBIG, PhilSys, and other national government portals.', grad:'from-cyan-500/15 to-cyan-600/5', glow:'group-hover:shadow-cyan-500/20' },
                { icon:'ðŸ“š', title:'Digital Literacy', desc:'Free trainings, workshops, and capacity-building sessions on digital skills for all ages.', grad:'from-amber-500/15 to-amber-600/5', glow:'group-hover:shadow-amber-500/20' },
              ].map(s => (
                <div key={s.title} className={`group service-card rounded-2xl p-7 bg-gradient-to-br ${s.grad} hover:shadow-2xl ${s.glow}`}>
                  <div className="text-4xl mb-5">{s.icon}</div>
                  <h3 className="font-bold text-white text-base mb-2 leading-tight">{s.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• STATS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <section id="about" ref={statsRef} className="py-28 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-cyan-400 text-xs font-black uppercase tracking-[0.3em] mb-4">By the Numbers</p>
              <h2 className="text-4xl md:text-5xl font-black text-white">Our Impact</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {[
                { val: visitors, suffix:'+', label:'Citizens Served', sub:'Since opening day', icon:'ðŸ‘¥', color:'text-blue-400' },
                { val: daily,    suffix:'+', label:'Daily Visitors',  sub:'On average',       icon:'ðŸ“ˆ', color:'text-violet-400' },
                { val: workstations, suffix:'', label:'Workstations', sub:'Always available',  icon:'ðŸ–¥ï¸', color:'text-cyan-400' },
              ].map(s => (
                <div key={s.label} className="stat-card rounded-2xl p-8 text-center">
                  <div className="text-3xl mb-3">{s.icon}</div>
                  <p className={`text-5xl font-black ${s.color}`}>{s.val.toLocaleString()}{s.suffix}</p>
                  <p className="text-white font-bold mt-2 text-sm">{s.label}</p>
                  <p className="text-gray-600 text-xs mt-1">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• CTA BAND â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <section className="py-28 px-6 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0"
            style={{background:'radial-gradient(ellipse at 50% 50%,rgba(59,130,246,.1) 0%,transparent 65%)'}}/>
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <h2 className="text-4xl md:text-6xl font-black text-white leading-tight mb-6">
              Ready to get<br/>
              <span className="shimmer-text">started?</span>
            </h2>
            <p className="text-gray-400 text-lg mb-10 leading-relaxed">
              Sign in at the logbook to use our services. Our staff will guide you upon arrival.
            </p>
            <Link href="/dtc-logbook"
              className="cta-primary inline-flex items-center gap-3 px-10 py-5 rounded-2xl font-bold text-white text-lg">
              <span className="text-2xl">ðŸ–¥ï¸</span>
              <span>Open the DTC Logbook</span>
              <span className="text-blue-200 text-xl">â†’</span>
            </Link>
          </div>
        </section>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• FOOTER â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <footer className="border-t border-white/5 py-10 px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 blur-sm opacity-60"/>
                <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[11px] font-black">DTC</div>
              </div>
              <div>
                <p className="font-bold text-white text-sm">DICT Region V â€” Bicol</p>
                <p className="text-gray-600 text-xs">Department of Information and Communications Technology</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-xs text-gray-600">
              <span>Â© {new Date().getFullYear()} DICT Region V</span>
              <span className="text-white/10">|</span>
              <a href="https://dict.gov.ph" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">dict.gov.ph</a>
              <span className="text-white/10">|</span>
              <Link href="/dtc-logbook" className="hover:text-blue-400 transition-colors">Logbook</Link>
            </div>
          </div>
        </footer>

      </div>
    </>
  )
}
