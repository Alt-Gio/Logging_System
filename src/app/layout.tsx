import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'DICT DTC Region V — Client Logbook',
  description: 'Digital Transformation Center Region V — Free ICT Services Logbook',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'DTC Logbook' },
}

export const viewport: Viewport = {
  themeColor: '#003082',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/admin"
    >
      <html lang="en">
        <head>
          <link rel="apple-touch-icon" href="/icon-192.png"/>
          <meta name="mobile-web-app-capable" content="yes"/>
          <link rel="preconnect" href="https://fonts.googleapis.com"/>
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
          <link
            href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
            rel="stylesheet"
          />
        </head>
        <body>
          {/*
            BgStyle is a server component that reads the custom bgImageUrl from DB
            at *request time* (not build time), injecting it as a CSS variable.
            This prevents flash: the background is set before the page renders.
            Client-side useEffect in each page also updates it live after settings save.
          */}
          <BgStyle/>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}

// ── Server component — injects dynamic BG CSS at request time ─────────────────
import { cache } from 'react'

const getBgUrl = cache(async (): Promise<string> => {
  try {
    const { prisma } = await import('@/lib/prisma')
    const row = await prisma.setting.findUnique({ where: { key: 'bgImageUrl' } })
    return row?.value ?? ''
  } catch {
    return ''
  }
})

async function BgStyle() {
  const url = await getBgUrl()
  // Always inject a style tag — either the custom URL or explicitly the default /Bg.png
  // This ensures the CSS variable is always defined on first paint
  const safeUrl = url
    ? url.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    : '/Bg.png'
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: `:root{--bg-image:url('${safeUrl}')}` }}
    />
  )
}
