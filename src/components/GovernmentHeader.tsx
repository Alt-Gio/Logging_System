'use client'
import { useState } from 'react'

function LogoImg({ src, alt, className, style, fallback }: {
  src: string; alt: string; className?: string; style?: React.CSSProperties; fallback: React.ReactNode
}) {
  const [err, setErr] = useState(false)
  if (err) return <>{fallback}</>
  return <img src={src} alt={alt} className={className} style={style} onError={() => setErr(true)}/>
}

// ILCDB logo — shown on the LEFT beside the title
export function GovSeal({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'sm' ? 32 : size === 'lg' ? 44 : 40
  return (
    <LogoImg
      src="/ilcdb-logo.png" alt="ILCDB"
      style={{
        height: h, objectFit: 'contain', borderRadius: '6px', flexShrink: 0,
        filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))',
      }}
      fallback={
        <div style={{
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: '8px', padding: '5px 10px', textAlign: 'center', flexShrink: 0,
        }}>
          <div style={{ color: '#FCD116', fontWeight: 900, fontSize: '12px', lineHeight: 1 }}>ILCDB</div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '7px', marginTop: '2px', lineHeight: 1.2 }}>ICT LITERACY &<br/>COMPETENCY DEV.</div>
        </div>
      }
    />
  )
}

// RIGHT side logos: DICT Seal | divider | Bagong Pilipinas
export function GovHeaderLogos() {
  const dim = 44
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="hidden sm:flex">
      <LogoImg
        src="/dict-seal.png" alt="DICT Seal"
        style={{
          width: dim, height: dim, objectFit: 'cover', borderRadius: '50%', flexShrink: 0,
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          border: '2px solid rgba(255,255,255,0.30)',
        }}
        fallback={
          <div style={{
            width: dim, height: dim, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.30)',
            background: 'rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.8)">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"/>
            </svg>
          </div>
        }
      />
      <div style={{ width: '1px', height: '36px', background: 'rgba(255,255,255,0.20)' }}/>
      <LogoImg
        src="/bagong-pilipinas.png" alt="Bagong Pilipinas"
        style={{
          width: dim, height: dim, objectFit: 'cover', borderRadius: '50%', flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          border: '2px solid rgba(255,255,255,0.22)',
        }}
        fallback={
          <div style={{
            width: dim, height: dim, borderRadius: '50%',
            border: '2px solid #FCD116', background: 'rgba(255,255,255,0.10)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <div style={{ color: '#FCD116', fontWeight: 900, fontSize: '7px', lineHeight: 1 }}>BAGONG</div>
            <div style={{ color: '#fff',    fontWeight: 900, fontSize: '6px', lineHeight: 1 }}>PILIPINAS</div>
            <div style={{ fontSize: '10px', marginTop: '1px' }}>🇵🇭</div>
          </div>
        }
      />
    </div>
  )
}
