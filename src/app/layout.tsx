import type { Metadata, Viewport } from 'next'
import { prisma } from '@/lib/prisma'
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Load custom bgImageUrl from DB (server-side — no flash, no client JS needed)
  let bgImageUrl = ''
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'bgImageUrl' } })
    if (row?.value) bgImageUrl = row.value
  } catch {}
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
          {/* Google Fonts — preloaded for performance */}
          <link rel="preconnect" href="https://fonts.googleapis.com"/>
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
          <link
            href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
            rel="stylesheet"
          />
        {bgImageUrl && (
          <style dangerouslySetInnerHTML={{ __html: `:root { --bg-image: url('${bgImageUrl.replace(/'/g, "\\'")}') }` }}/>
        )}
        </head>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
