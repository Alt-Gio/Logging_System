'use client'
import { useEffect, useRef, useState } from 'react'

const POSTS = [
  // The iframe handles the posts — we just style the container
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
    script.src = 'https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v19.0&appId=3077260962663166'
    script.async = true
    script.defer = true
    script.onload = () => setSdkReady(true)
    document.head.appendChild(script)
  }, [])

  return (
    <section className="py-16 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest mb-4">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            DICT Region V — Official Facebook
          </span>
          <h2 className="text-3xl font-bold text-white">Latest Updates</h2>
          <p className="text-blue-300/60 text-sm mt-2">Follow us for real-time news and announcements</p>
        </div>

        {/* Horizontal scroll container */}
        <div className="relative">
          {/* Left fade */}
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#0a0f1e] to-transparent z-10 pointer-events-none" />
          {/* Right fade */}
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#0a0f1e] to-transparent z-10 pointer-events-none" />

          <div className="overflow-x-auto scrollbar-hide pb-4"
               style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="flex gap-6 w-max px-8">
              {/* Facebook page embed — single scrollable widget */}
              <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-blue-900/20 bg-white flex-shrink-0"
                   style={{ width: 380 }}>
                <div id="fb-root" />
                <div
                  className="fb-page"
                  data-href="https://www.facebook.com/DICTRegionVBicol"
                  data-tabs="timeline"
                  data-width="380"
                  data-height="600"
                  data-small-header="true"
                  data-adapt-container-width="false"
                  data-hide-cover="false"
                  data-show-facepile="false"
                />
              </div>

              {/* Info cards alongside */}
              <div className="flex flex-col gap-4 flex-shrink-0 w-72 justify-center">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                  <div className="text-3xl mb-3">📣</div>
                  <h3 className="text-white font-bold mb-2">Stay Updated</h3>
                  <p className="text-blue-200/60 text-sm leading-relaxed">
                    Follow DICT Region V Bicol on Facebook for the latest news, 
                    events, and digital services updates.
                  </p>
                  
                    href="https://www.facebook.com/DICTRegionVBicol"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-4 text-blue-400 text-sm font-semibold hover:text-blue-300 transition-colors"
                  >
                    Visit our page →
                  </a>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                  <div className="text-3xl mb-3">🏛️</div>
                  <h3 className="text-white font-bold mb-2">DICT DTC Region V</h3>
                  <p className="text-blue-200/60 text-sm leading-relaxed">
                    Digital Transformation Center<br />
                    Legazpi City, Albay<br />
                    Free ICT services for all Bicolanos
                  </p>
                </div>

                <div className="bg-blue-600/20 border border-blue-500/30 rounded-2xl p-6 backdrop-blur-sm">
                  <div className="text-3xl mb-3">💻</div>
                  <h3 className="text-white font-bold mb-2">Free Services</h3>
                  <ul className="text-blue-200/60 text-sm space-y-1">
                    <li>✓ Internet Access</li>
                    <li>✓ Document Processing</li>
                    <li>✓ Digital Literacy</li>
                    <li>✓ eGov Services</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Follow button */}
        <div className="text-center mt-8">
          
            href="https://www.facebook.com/DICTRegionVBicol"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-3 rounded-full transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 hover:scale-105"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Follow DICT Region V Bicol
          </a>
        </div>
      </div>
    </section>
  )
}
