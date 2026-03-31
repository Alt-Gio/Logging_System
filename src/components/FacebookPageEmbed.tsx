'use client'
import { useEffect, useState } from 'react'

const INFO_CARDS = [
  { icon: '🌐', title: 'Free Internet Access', desc: 'High-speed internet access for all walk-in clients at the Digital Transformation Center.', color: 'from-blue-600/20 to-blue-800/10', border: 'border-blue-500/20', glow: 'hover:shadow-blue-500/20' },
  { icon: '📄', title: 'Document Processing', desc: 'Government online transactions, forms, and digital document services.', color: 'from-indigo-600/20 to-indigo-800/10', border: 'border-indigo-500/20', glow: 'hover:shadow-indigo-500/20' },
  { icon: '🎓', title: 'Digital Literacy', desc: 'Free workshops and training sessions on digital skills for all ages.', color: 'from-cyan-600/20 to-cyan-800/10', border: 'border-cyan-500/20', glow: 'hover:shadow-cyan-500/20' },
  { icon: '🏛️', title: 'eGov Services', desc: 'SSS, PhilHealth, Pag-IBIG, and other government online portals with staff assistance.', color: 'from-violet-600/20 to-violet-800/10', border: 'border-violet-500/20', glow: 'hover:shadow-violet-500/20' },
  { icon: '🔒', title: 'Cybersecurity Awareness', desc: 'Learn how to stay safe online. Free seminars on cybersecurity and data privacy.', color: 'from-emerald-600/20 to-emerald-800/10', border: 'border-emerald-500/20', glow: 'hover:shadow-emerald-500/20' },
  { icon: '📡', title: 'Digital Connectivity', desc: 'DICT Region V bridges the digital divide, bringing ICT services to underserved communities.', color: 'from-rose-600/20 to-rose-800/10', border: 'border-rose-500/20', glow: 'hover:shadow-rose-500/20' },
]

export function FacebookPageEmbed() {
  const [sdkReady, setSdkReady] = useState(false)

  useEffect(() => {
    if ((window as any).FB) {
      (window as any).FB.XFBML.parse()
      setSdkReady(true)
      return
    }
    const script = document.createElement('script')
    script.id = 'fb-sdk'
    script.src = 'https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v19.0&appId=3077260962663166'
    script.async = true
    script.defer = true
    script.onload = () => setSdkReady(true)
    document.head.appendChild(script)
  }, [])

  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>
      <div className="max-w-7xl mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold px-4 py-2 rounded-full uppercase tracking-widest mb-4">
            Official Facebook Page
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">DICT Region V Bicol</h2>
          <p className="text-blue-300/60 text-lg max-w-2xl mx-auto">
            Stay connected with the latest news, events, and digital services from the Digital Transformation Center.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="lg:sticky lg:top-8">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl blur opacity-20 group-hover:opacity-30 transition-opacity duration-500" />
              <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/5">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">DICT Region V - Bicol</p>
                    <p className="text-blue-300/50 text-xs">Official Government Page</p>
                  </div>
                  <div className="ml-auto">
                    <span className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      Live
                    </span>
                  </div>
                </div>
                <div id="fb-root" />
                {!sdkReady && (
                  <div className="h-[600px] flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-blue-300/50 text-sm">Loading feed...</p>
                    </div>
                  </div>
                )}
                <div className="fb-page" data-href="https://www.facebook.com/DICTRegionVBicol" data-tabs="timeline" data-width="600" data-height="600" data-small-header="true" data-adapt-container-width="true" data-hide-cover="false" data-show-facepile="false" />
              </div>
            </div>
            <a href="https://www.facebook.com/DICTRegionVBicol" target="_blank" rel="noopener noreferrer"
              className="mt-4 w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-blue-600/30 hover:scale-[1.02]">
              Follow DICT Region V Bicol on Facebook
            </a>
          </div>

          <div className="flex flex-col gap-4">
            {INFO_CARDS.map((card, i) => (
              <div key={i}
                className={`group relative bg-gradient-to-br ${card.color} border ${card.border} rounded-2xl p-6 cursor-default transition-all duration-300 ease-out hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl ${card.glow}`}>
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                <div className="flex items-start gap-4">
                  <div className="text-3xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300">{card.icon}</div>
                  <div>
                    <h3 className="text-white font-bold text-lg mb-1 group-hover:text-blue-200 transition-colors">{card.title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed group-hover:text-white/70 transition-colors">{card.desc}</p>
                  </div>
                </div>
              </div>
            ))}

            <div className="grid grid-cols-3 gap-3 mt-2">
              {[
                { num: '12', label: 'Workstations', icon: '🖥️' },
                { num: 'Free', label: 'All Services', icon: '✅' },
                { num: '8AM-5PM', label: 'Mon-Fri', icon: '🕐' },
              ].map((stat, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center hover:bg-white/10 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 cursor-default">
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <div className="text-white font-bold text-lg">{stat.num}</div>
                  <div className="text-white/40 text-xs">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
