'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export default function MeetingHallPage() {
  const cursorRef  = useRef<HTMLDivElement>(null)
  const ringRef    = useRef<HTMLDivElement>(null)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name:'', email:'', phone:'', date:'', purpose:'', attendees:'', org:'' })

  // Custom cursor
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (cursorRef.current) { cursorRef.current.style.left = e.clientX + 'px'; cursorRef.current.style.top = e.clientY + 'px' }
      if (ringRef.current)   { ringRef.current.style.left   = e.clientX + 'px'; ringRef.current.style.top  = e.clientY + 'px' }
    }
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [])

  // 3D card tilt
  useEffect(() => {
    const cards = ['1','2'].map(n => ({
      wrap:  document.getElementById(`wrap${n}`)   as HTMLDivElement | null,
      card:  document.getElementById(`card${n}`)   as HTMLDivElement | null,
      glare: document.getElementById(`glare${n}`)  as HTMLDivElement | null,
      shadow:document.getElementById(`shadow${n}`) as HTMLDivElement | null,
      img:   document.getElementById(`img${n}`)    as HTMLImageElement| null,
    }))
    const cleanup: (() => void)[] = []
    cards.forEach(({ wrap, card, glare, shadow }) => {
      if (!wrap || !card) return
      const onMove = (e: MouseEvent) => {
        const r = wrap.getBoundingClientRect()
        const x = (e.clientX - r.left)  / r.width  - 0.5
        const y = (e.clientY - r.top)   / r.height - 0.5
        card.style.transform = `rotateY(${x * 20}deg) rotateX(${-y * 20}deg)`
        if (glare)  glare.style.background  = `radial-gradient(circle at ${(x+.5)*100}% ${(y+.5)*100}%, rgba(255,255,255,.15) 0%, transparent 60%)`
        if (shadow) shadow.style.transform  = `translateX(${x * 20}px) translateY(${y * 10}px)`
      }
      const onLeave = () => {
        card.style.transform = 'rotateY(0) rotateX(0)'
        if (glare)  glare.style.background  = ''
        if (shadow) shadow.style.transform  = ''
      }
      wrap.addEventListener('mousemove', onMove as EventListener)
      wrap.addEventListener('mouseleave', onLeave)
      cleanup.push(() => { wrap.removeEventListener('mousemove', onMove as EventListener); wrap.removeEventListener('mouseleave', onLeave) })
    })
    return () => cleanup.forEach(fn => fn())
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        .mh-body { cursor: none; background: #0e0f0d; color: #f0f2ec; font-family: 'DM Sans', sans-serif; overflow-x: hidden; min-height: 100vh; }
        #mh-cursor { position:fixed;width:12px;height:12px;background:#c8ff3e;border-radius:50%;pointer-events:none;z-index:9999;transform:translate(-50%,-50%);transition:width .2s,height .2s;mix-blend-mode:difference; }
        #mh-ring   { position:fixed;width:40px;height:40px;border:1px solid rgba(200,255,62,.5);border-radius:50%;pointer-events:none;z-index:9998;transform:translate(-50%,-50%);transition:all .1s ease-out; }
        .mh-hero { height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;position:relative;overflow:hidden; }
        .mh-hero::before { content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 50% at 50% 60%,rgba(106,191,71,.12) 0%,transparent 70%); }
        .mh-label { font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#c8ff3e;margin-bottom:24px;opacity:0;animation:mhFadeUp .8s .2s forwards; }
        .mh-title { font-family:'Syne',sans-serif;font-size:clamp(46px,8vw,100px);font-weight:800;line-height:.9;opacity:0;animation:mhFadeUp .8s .4s forwards; }
        .mh-title em { font-style:normal;color:#c8ff3e;display:block; }
        .mh-sub { font-size:15px;color:rgba(240,242,236,.5);margin-top:28px;max-width:420px;opacity:0;animation:mhFadeUp .8s .6s forwards; }
        .mh-scroll { position:absolute;bottom:36px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(240,242,236,.3);opacity:0;animation:mhFadeUp .8s 1s forwards;display:flex;flex-direction:column;align-items:center;gap:10px; }
        .mh-scroll::after { content:'';display:block;width:1px;height:50px;background:linear-gradient(to bottom,rgba(200,255,62,.5),transparent);animation:mhScrollLine 1.5s ease-in-out infinite; }
        .mh-section { padding:100px 6vw;position:relative; }
        .mh-section-label { font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#c8ff3e;margin-bottom:20px; }
        .mh-section-title { font-family:'Syne',sans-serif;font-size:clamp(28px,4vw,52px);font-weight:800;line-height:1.1;max-width:600px;margin-bottom:56px; }
        .mh-cards-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,560px),1fr));gap:48px; }
        .mh-card-wrap { perspective:1200px;position:relative; }
        .mh-card-3d { position:relative;transform-style:preserve-3d;transition:transform .08s linear;border-radius:16px;overflow:visible;will-change:transform; }
        .mh-card-img { position:relative;border-radius:16px;overflow:hidden;box-shadow:0 50px 100px rgba(0,0,0,.7),0 25px 50px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.05); }
        .mh-card-img img { width:100%;display:block;aspect-ratio:16/9;object-fit:cover;transform:scale(1.02);transition:transform .3s ease; }
        .mh-card-glare { position:absolute;inset:0;border-radius:16px;pointer-events:none;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.12) 0%,transparent 60%);opacity:0;transition:opacity .3s;z-index:2; }
        .mh-card-3d:hover .mh-card-glare { opacity:1; }
        .mh-card-depth { position:absolute;inset:0;border-radius:16px;background:linear-gradient(135deg,rgba(106,191,71,.08) 0%,transparent 40%,rgba(0,0,0,.3) 100%);z-index:1;pointer-events:none; }
        .mh-badge { position:absolute;transform-style:preserve-3d;z-index:10;pointer-events:none; }
        .mh-badge-pill { background:rgba(14,15,13,.85);backdrop-filter:blur(12px);border:1px solid rgba(200,255,62,.3);border-radius:100px;padding:8px 16px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#c8ff3e;font-weight:500;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.5); }
        .mh-badge-sq { background:#c8ff3e;border-radius:12px;padding:10px 14px;font-size:20px;font-family:'Syne',sans-serif;font-weight:800;color:#0e0f0d;box-shadow:0 12px 30px rgba(200,255,62,.35);white-space:nowrap; }
        .b1{top:-18px;left:24px;transform:translateZ(60px)} .b2{bottom:24px;right:-10px;transform:translateZ(40px)} .b3{top:50%;left:-16px;transform:translateY(-50%) translateZ(50px)} .b4{top:-14px;right:32px;transform:translateZ(55px)} .b5{bottom:-14px;left:50%;transform:translateX(-50%) translateZ(45px)}
        .mh-shadow-plane { position:absolute;bottom:-30px;left:5%;right:5%;height:60px;background:radial-gradient(ellipse,rgba(106,191,71,.25) 0%,transparent 70%);filter:blur(20px);pointer-events:none;transition:transform .08s linear,opacity .3s;opacity:.5; }
        .mh-room-num { position:absolute;font-family:'Syne',sans-serif;font-size:180px;font-weight:800;color:rgba(200,255,62,.04);top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;user-select:none; }
        .mh-card-info { margin-top:24px;display:flex;justify-content:space-between;align-items:flex-end;padding:0 4px; }
        .mh-card-info h3 { font-family:'Syne',sans-serif;font-size:20px;font-weight:700; }
        .mh-card-info p { font-size:13px;color:rgba(240,242,236,.4);margin-top:3px; }
        .mh-tag { background:rgba(106,191,71,.12);border:1px solid rgba(106,191,71,.2);border-radius:6px;padding:4px 12px;font-size:11px;color:#6abf47;letter-spacing:1px;text-transform:uppercase; }
        .mh-stats { display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-top:100px;border:1px solid rgba(255,255,255,.06);border-radius:16px;overflow:hidden; }
        .mh-stat { padding:36px 28px;background:rgba(255,255,255,.02);border-right:1px solid rgba(255,255,255,.04);transition:background .3s; }
        .mh-stat:last-child { border-right:none; }
        .mh-stat:hover { background:rgba(200,255,62,.04); }
        .mh-stat-num { font-family:'Syne',sans-serif;font-size:44px;font-weight:800;color:#c8ff3e;line-height:1; }
        .mh-stat-label { font-size:11px;color:rgba(240,242,236,.4);margin-top:8px;letter-spacing:1px;text-transform:uppercase; }
        .mh-footer { padding:56px 6vw;border-top:1px solid rgba(255,255,255,.06);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px; }
        .mh-footer .logo { font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:#c8ff3e; }
        body::after { display:none !important; }
        @keyframes mhFadeUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes mhScrollLine { 0%{transform:scaleY(0);transform-origin:top} 50%{transform:scaleY(1);transform-origin:top} 51%{transform:scaleY(1);transform-origin:bottom} 100%{transform:scaleY(0);transform-origin:bottom} }
        @media(max-width:640px){ .mh-stats{grid-template-columns:1fr} .mh-stat{border-right:none;border-bottom:1px solid rgba(255,255,255,.04)} .b2,.b3,.b4,.b5{display:none} }
      `}</style>

      {/* ── Custom cursor ── */}
      <div id="mh-cursor" ref={cursorRef} />
      <div id="mh-ring"   ref={ringRef}   />

      <div className="mh-body">

        {/* ── Back nav ── */}
        <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4"
          style={{ background: 'rgba(14,15,13,.7)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <Link href="/" className="text-sm font-bold tracking-wide" style={{ color: '#c8ff3e', fontFamily: 'Syne, sans-serif' }}>
            ← DICT DTC
          </Link>
          <a href="#book"
            className="text-xs font-bold uppercase tracking-widest px-5 py-2.5 rounded-full border transition-all"
            style={{ color: '#0e0f0d', background: '#c8ff3e', borderColor: '#c8ff3e' }}>
            Book the Hall
          </a>
        </div>

        {/* ── Hero ── */}
        <section className="mh-hero">
          <p className="mh-label">DICT — Region V &nbsp;·&nbsp; Digital Transformation Center</p>
          <h1 className="mh-title">
            The Space<br />
            <em>Where Change</em><br />
            Begins.
          </h1>
          <p className="mh-sub">
            Book the DICT DTC Meeting Hall for seminars, orientations, and government events — Legazpi City, Albay.
          </p>
          <div className="mh-scroll">Explore</div>
        </section>

        {/* ── 3D Cards ── */}
        <section className="mh-section">
          <p className="mh-section-label">Our Spaces</p>
          <h2 className="mh-section-title">Step Inside the Center</h2>

          <div className="mh-cards-grid">

            {/* Card 1 — Conference Room */}
            <div className="mh-card-wrap" id="wrap1">
              <span className="mh-room-num">01</span>
              <div className="mh-card-3d" id="card1">
                <div className="mh-card-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img id="img1" src="/interactive-banner.jpg" alt="Conference Room" />
                  <div className="mh-card-depth" />
                  <div className="mh-card-glare" id="glare1" />
                </div>
                <div className="mh-badge b1"><div className="mh-badge-pill">Conference Room</div></div>
                <div className="mh-badge b2"><div className="mh-badge-sq">DTC</div></div>
                <div className="mh-badge b3"><div className="mh-badge-pill">Live Display</div></div>
              </div>
              <div className="mh-shadow-plane" id="shadow1" />
              <div className="mh-card-info">
                <div>
                  <h3>Innovation Hub</h3>
                  <p>Meeting &amp; Collaboration Space · Legazpi City</p>
                </div>
                <span className="mh-tag">Gov't Grade</span>
              </div>
            </div>

            {/* Card 2 — Main Hall */}
            <div className="mh-card-wrap" id="wrap2">
              <span className="mh-room-num">02</span>
              <div className="mh-card-3d" id="card2">
                <div className="mh-card-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img id="img2" src="/BG.png" alt="Main Hall" style={{ objectPosition: 'center top' }} />
                  <div className="mh-card-depth" />
                  <div className="mh-card-glare" id="glare2" />
                </div>
                <div className="mh-badge b4"><div className="mh-badge-pill">Open Workspace</div></div>
                <div className="mh-badge b5"><div className="mh-badge-pill">Freedom Wall</div></div>
                <div className="mh-badge b3"><div className="mh-badge-sq">V</div></div>
              </div>
              <div className="mh-shadow-plane" id="shadow2" />
              <div className="mh-card-info">
                <div>
                  <h3>Collaboration Floor</h3>
                  <p>Open Workspace · Region V Operations</p>
                </div>
                <span className="mh-tag">Active</span>
              </div>
            </div>

          </div>

          {/* Stats bar */}
          <div className="mh-stats">
            <div className="mh-stat">
              <div className="mh-stat-num">30+</div>
              <div className="mh-stat-label">Seat Capacity</div>
            </div>
            <div className="mh-stat">
              <div className="mh-stat-num">Free</div>
              <div className="mh-stat-label">Government &amp; NGO Use</div>
            </div>
            <div className="mh-stat">
              <div className="mh-stat-num">DTC</div>
              <div className="mh-stat-label">DICT Region V — Bicol</div>
            </div>
          </div>
        </section>

        {/* ── Amenities ── */}
        <section className="mh-section" style={{ paddingTop: 0 }}>
          <p className="mh-section-label">Amenities</p>
          <h2 className="mh-section-title" style={{ marginBottom: 32 }}>What&apos;s Included</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[
              ['📺', 'Large Display Screen',     'HD monitor for presentations'],
              ['📶', 'High-Speed Wi-Fi',          'Dedicated fiber connection'],
              ['❄️', 'Air Conditioning',           'Climate-controlled comfort'],
              ['🔌', 'Power Outlets',             'Multiple outlets throughout'],
              ['🎤', 'Audio System',              'Microphone &amp; speaker setup'],
              ['📷', 'Camera Ready',              'Suitable for video conferences'],
            ].map(([icon, title, desc], i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: '20px 22px', transition: 'background .3s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,255,62,.04)') }
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.03)') }>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
                <h4 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{title}</h4>
                <p style={{ fontSize: 12, color: 'rgba(240,242,236,.4)', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: desc }} />
              </div>
            ))}
          </div>
        </section>

        {/* ── Booking Form ── */}
        <section id="book" className="mh-section" style={{ paddingTop: 0 }}>
          <p className="mh-section-label">Reserve Your Date</p>
          <h2 className="mh-section-title" style={{ marginBottom: 40 }}>Book the Meeting Hall</h2>

          {submitted ? (
            <div style={{ maxWidth: 560, background: 'rgba(200,255,62,.06)', border: '1px solid rgba(200,255,62,.25)', borderRadius: 20, padding: '48px 40px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, marginBottom: 10, color: '#c8ff3e' }}>Request Submitted!</h3>
              <p style={{ fontSize: 14, color: 'rgba(240,242,236,.55)', lineHeight: 1.7 }}>
                Your booking inquiry has been received. DICT DTC staff will contact you within 1–2 business days at the email or phone number you provided.
              </p>
              <button
                onClick={() => { setSubmitted(false); setForm({ name:'', email:'', phone:'', date:'', purpose:'', attendees:'', org:'' }) }}
                style={{ marginTop: 28, background: 'rgba(200,255,62,.12)', border: '1px solid rgba(200,255,62,.3)', borderRadius: 10, padding: '10px 24px', fontSize: 13, color: '#c8ff3e', cursor: 'none', fontWeight: 600 }}>
                Submit another request
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { field:'name',      label:'Full Name *',           type:'text',     placeholder:'Juan dela Cruz' },
                { field:'org',       label:'Organization / Agency', type:'text',     placeholder:'DICT, LGU, NGO…' },
                { field:'email',     label:'Email Address *',       type:'email',    placeholder:'you@example.com' },
                { field:'phone',     label:'Phone / Mobile *',      type:'tel',      placeholder:'+63 9XX XXX XXXX' },
                { field:'date',      label:'Preferred Date *',      type:'date',     placeholder:'' },
                { field:'attendees', label:'Expected Attendees *',  type:'number',   placeholder:'e.g. 25' },
              ].map(({ field, label, type, placeholder }) => (
                <div key={field}>
                  <label style={{ display:'block', fontSize:11, letterSpacing:'2px', textTransform:'uppercase', color:'rgba(200,255,62,.7)', marginBottom:8 }}>{label}</label>
                  <input
                    type={type}
                    required={label.endsWith('*')}
                    placeholder={placeholder}
                    value={(form as Record<string,string>)[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    style={{ width:'100%', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'13px 16px', fontSize:14, color:'#f0f2ec', outline:'none', cursor:'none', transition:'border-color .2s' }}
                    onFocus={e => (e.target.style.borderColor='rgba(200,255,62,.5)')}
                    onBlur={e  => (e.target.style.borderColor='rgba(255,255,255,.1)')}
                  />
                </div>
              ))}
              <div>
                <label style={{ display:'block', fontSize:11, letterSpacing:'2px', textTransform:'uppercase', color:'rgba(200,255,62,.7)', marginBottom:8 }}>Purpose / Description *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Briefly describe the event (e.g. Municipal digital literacy training, LGU orientation)"
                  value={form.purpose}
                  onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                  style={{ width:'100%', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'13px 16px', fontSize:14, color:'#f0f2ec', outline:'none', resize:'vertical', cursor:'none', transition:'border-color .2s', fontFamily:'inherit' }}
                  onFocus={e => (e.target.style.borderColor='rgba(200,255,62,.5)')}
                  onBlur={e  => (e.target.style.borderColor='rgba(255,255,255,.1)')}
                />
              </div>
              <button type="submit"
                style={{ marginTop:8, background:'#c8ff3e', color:'#0e0f0d', border:'none', borderRadius:12, padding:'16px 32px', fontSize:14, fontWeight:800, fontFamily:'Syne, sans-serif', letterSpacing:'1px', textTransform:'uppercase', cursor:'none', transition:'box-shadow .3s, transform .2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow='0 12px 36px rgba(200,255,62,.35)'; (e.currentTarget as HTMLButtonElement).style.transform='translateY(-2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow='none'; (e.currentTarget as HTMLButtonElement).style.transform='none' }}>
                Submit Booking Inquiry
              </button>
              <p style={{ fontSize:11, color:'rgba(240,242,236,.3)', lineHeight:1.6 }}>
                Booking is subject to availability and DICT DTC approval. Government and public-service events are prioritized. You will be contacted to confirm your reservation.
              </p>
            </form>
          )}
        </section>

        {/* ── Footer ── */}
        <footer className="mh-footer">
          <div className="logo">DICT DTC · Region V</div>
          <p style={{ fontSize:12, color:'rgba(240,242,236,.3)' }}>
            Department of Information and Communications Technology · Legazpi City, Albay
          </p>
          <Link href="/" style={{ fontSize:12, color:'rgba(200,255,62,.6)', textDecoration:'none', letterSpacing:1 }}>
            ← Back to main site
          </Link>
        </footer>

      </div>
    </>
  )
}
