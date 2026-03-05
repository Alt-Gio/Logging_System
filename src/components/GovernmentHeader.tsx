'use client'
import { useState } from 'react'

function LogoImg({ src, alt, className, fallback }: {
  src: string; alt: string; className: string; fallback: React.ReactNode
}) {
  const [err, setErr] = useState(false)
  if (err) return <>{fallback}</>
  return <img src={src} alt={alt} className={className} onError={() => setErr(true)}/>
}

export function GovSeal({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-9 h-9' : size === 'lg' ? 'w-12 h-12' : 'w-11 h-11'
  return (
    <LogoImg
      src="/dict-seal.png" alt="DICT Seal"
      className={`${sz} object-cover rounded-full flex-shrink-0 shadow-sm`}
      fallback={
        <div className={`${sz} rounded-full border-2 border-white/30 bg-white/10 flex items-center justify-center flex-shrink-0`}>
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"/>
          </svg>
        </div>
      }
    />
  )
}

export function GovHeaderLogos() {
  return (
    <div className="hidden sm:flex items-center gap-3">
      {/* ILCDB — rectangular logo */}
      <LogoImg
        src="/ilcdb-logo.png" alt="ILCDB"
        className="h-10 object-contain rounded"
        fallback={
          <div className="bg-white/15 border border-white/25 rounded-lg px-2.5 py-1.5 text-center">
            <div className="text-[#FCD116] font-display font-black text-sm leading-none">ILCDB</div>
            <div className="text-white/70 text-[8px] leading-tight mt-0.5">ICT LITERACY &</div>
            <div className="text-white/70 text-[8px] leading-tight">COMPETENCY DEV.</div>
          </div>
        }
      />
      <div className="w-px h-10 bg-white/20"/>
      {/* Bagong Pilipinas — circular seal */}
      <LogoImg
        src="/bagong-pilipinas.png" alt="Bagong Pilipinas"
        className="w-11 h-11 object-cover rounded-full flex-shrink-0 shadow-sm"
        fallback={
          <div className="w-11 h-11 rounded-full border-2 border-[#FCD116] bg-white/10 flex flex-col items-center justify-center flex-shrink-0">
            <div className="text-[#FCD116] font-display font-black text-[8px] leading-none">BAGONG</div>
            <div className="text-white font-display font-black text-[7px] leading-none">PILIPINAS</div>
            <div className="text-[#FCD116] text-[9px] mt-0.5">🇵🇭</div>
          </div>
        }
      />
    </div>
  )
}
