// NextAuth v5 middleware
// Required env vars: AUTH_SECRET, DATABASE_URL

import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/',
  '/sign-in',
  '/print',
  '/offline',
  '/api/health',
  '/api/auth',
  '/api/settings',
  '/api/pcs',
  '/api/cron',
  '/api/announcements',
  '/api/logs',
  '/api/network/bridge',
  '/api/interns',
  '/api/sheets',
  '/api/intern-sessions',
  '/api/intern-tasks',
  '/intern-logbook',
  '/intern',
]

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?'))
}

const ADMIN_PATHS = [
  '/admin',
  '/interns',
  '/certificates',
  '/api/admin-logs',
  '/api/admins',
  '/api/cameras',
  '/api/network',
  '/api/stats',
  '/api/logs/export',
  '/api/invitations',
  '/api/certificates',
]

function isAdmin(pathname: string): boolean {
  return ADMIN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'SAMEORIGIN')
  res.headers.set('X-XSS-Protection', '1; mode=block')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.pusher.com https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://res.cloudinary.com https://api.qrserver.com",
    "connect-src 'self' https://*.pusher.com wss://*.pusher.com https://res.cloudinary.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '))
  return res
}

export default auth((req: NextRequest & { auth: { user?: { id?: string } } | null }) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    /\.(png|jpg|jpeg|ico|svg|webp|json|txt|js|css|woff2?|ttf)$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  if (isPublic(pathname)) {
    return applySecurityHeaders(NextResponse.next())
  }

  if (isAdmin(pathname) && !session?.user?.id) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('callbackUrl', req.url)
    return NextResponse.redirect(signInUrl)
  }

  return applySecurityHeaders(NextResponse.next())
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
