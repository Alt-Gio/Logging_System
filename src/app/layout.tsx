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
      afterSignInUrl="/admin"
      afterSignUpUrl="/admin"
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
          {/* BgStyle loads the custom background URL from DB at request-time (not build-time) */}
          <BgStyle/>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}

// ── Server component that injects dynamic CSS variable for background ─────────
// Imported inline to keep layout.tsx a single file.
// Uses React's cache + prisma only at request time, never at build time.
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
  if (!url) return null
  const safe = url.replace(/'/g, "\\'").replace(/\\/g, '\\\\')
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: `:root{--bg-image:url('${safe}')}` }}
    />
  )
}
