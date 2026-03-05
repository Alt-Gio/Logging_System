<<<<<<< HEAD
import type { Metadata, Viewport } from 'next'
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
=======
// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DTC Region V – Client Logbook',
  description: 'Digital Transformation Center – Region V | Client Logbook System',
>>>>>>> 41c2fab67e2056a336b2c8168d30a3e8d0f6ab74
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
<<<<<<< HEAD
        <link rel="apple-touch-icon" href="/icon-192.png"/>
        <meta name="mobile-web-app-capable" content="yes"/>
      </head>
      <body>{children}</body>
=======
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Sora:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
>>>>>>> 41c2fab67e2056a336b2c8168d30a3e8d0f6ab74
    </html>
  )
}
