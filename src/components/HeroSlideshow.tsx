'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

export type HeroSlide = {
  _id:         string
  title:       string
  description?: string
  mediaUrl:    string
  mediaType:   'image' | 'video'
  order:       number
  active:      boolean
}

type Props = {
  slides: HeroSlide[]
  /** ms before auto-advancing an image slide (default 8000) */
  imageDuration?: number
}

const IMAGE_DURATION = 8_000

export function HeroSlideshow({ slides, imageDuration = IMAGE_DURATION }: Props) {
  const [current, setCurrent]   = useState(0)
  const [visible, setVisible]   = useState(true)  // for crossfade
  const [progress, setProgress] = useState(0)
  const videoRef    = useRef<HTMLVideoElement>(null)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef      = useRef<number | null>(null)
  const startRef    = useRef<number>(0)

  const count = slides.length
  const slide = slides[current]

  const goTo = useCallback((idx: number) => {
    setVisible(false)
    setTimeout(() => {
      setCurrent((idx + count) % count)
      setProgress(0)
      setVisible(true)
    }, 350)
  }, [count])

  const next = useCallback(() => goTo(current + 1), [goTo, current])
  const prev = useCallback(() => goTo(current - 1), [goTo, current])

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (rafRef.current)   cancelAnimationFrame(rafRef.current)
  }, [])

  // Animate progress bar for image slides
  const startProgress = useCallback(() => {
    startRef.current = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - startRef.current) / imageDuration, 1)
      setProgress(p)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    timerRef.current = setTimeout(next, imageDuration)
  }, [imageDuration, next])

  useEffect(() => {
    if (!slide) return
    clearTimers()
    setProgress(0)
    if (slide.mediaType === 'image') {
      startProgress()
    }
    // For video slides, advance is triggered by onEnded
    return clearTimers
  }, [current, slide?.mediaType, clearTimers, startProgress])

  if (!slides.length) return null

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      {/* Slide backgrounds — render all, show current */}
      {slides.map((s, i) => (
        <div
          key={s._id}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === current && visible ? 1 : 0, zIndex: i === current ? 1 : 0 }}
        >
          {s.mediaType === 'video' ? (
            <video
              ref={i === current ? videoRef : undefined}
              src={s.mediaUrl}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              onEnded={next}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.mediaUrl}
              alt={s.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {/* Dark gradient overlay — always present */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, rgba(7,14,27,.55) 0%, rgba(7,14,27,.15) 40%, rgba(7,14,27,.80) 100%)' }}
          />
        </div>
      ))}

      {/* ── Top-right slide info card ── */}
      {slide && visible && (
        <div
          className="absolute top-[72px] right-4 sm:right-8 z-20 max-w-[220px] sm:max-w-xs"
          style={{ animation: 'slideInfoIn .4s ease both' }}
        >
          <div
            className="rounded-2xl px-4 py-3 text-right"
            style={{ background: 'rgba(7,14,27,.72)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,.10)' }}
          >
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-400 mb-1">
              {slide.mediaType === 'video' ? '▶ Video' : '🖼 Photo'}
              {count > 1 && <span className="ml-2 text-white/30">{current + 1}/{count}</span>}
            </p>
            <p className="text-white font-bold text-sm leading-snug">{slide.title}</p>
            {slide.description && (
              <p className="text-white/50 text-[11px] mt-1 leading-snug">{slide.description}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Prev / Next arrows ── */}
      {count > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-all"
            style={{ background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(8px)' }}
            aria-label="Previous slide"
          >‹</button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-all"
            style={{ background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(8px)' }}
            aria-label="Next slide"
          >›</button>
        </>
      )}

      {/* ── Bottom: dot indicators + progress bar ── */}
      {count > 1 && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="relative h-1.5 rounded-full overflow-hidden transition-all duration-300"
              style={{ width: i === current ? 32 : 8, background: 'rgba(255,255,255,.25)' }}
              aria-label={`Go to slide ${i + 1}`}
            >
              {i === current && slide?.mediaType === 'image' && (
                <div
                  className="absolute inset-y-0 left-0 bg-white rounded-full"
                  style={{ width: `${progress * 100}%`, transition: 'none' }}
                />
              )}
              {i === current && slide?.mediaType === 'video' && (
                <div className="absolute inset-0 bg-white/80 rounded-full" />
              )}
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes slideInfoIn {
          from { opacity: 0; transform: translateX(12px) }
          to   { opacity: 1; transform: translateX(0) }
        }
      `}</style>
    </div>
  )
}
