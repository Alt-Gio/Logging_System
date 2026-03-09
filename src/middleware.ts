// Required Railway env vars:
// NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY
// NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
// NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
// NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/admin
// NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/admin

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/print(.*)',
  '/api/health',
  '/api/auth(.*)',
  '/api/settings(.*)',
  '/api/pcs(.*)',
  '/api/cron(.*)',
  '/api/announcements(.*)',
  '/api/logs',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/invite(.*)',
])

const isAdminRoute = createRouteMatcher([
  '/admin(.*)',
  '/api/admin-logs(.*)',
  '/api/admins(.*)',
  '/api/cameras(.*)',
  '/api/network(.*)',
  '/api/stats(.*)',
  '/api/logs/export(.*)',
  '/api/logs/(.+)',
  '/api/invitations(.*)',
])

function securityHeaders(res: NextResponse) {
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'SAMEORIGIN')
  res.headers.set('X-XSS-Protection', '1; mode=block')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.pusher.com https://*.clerk.accounts.dev https://clerk.accounts.dev https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://res.cloudinary.com https://api.qrserver.com https://img.clerk.com",
    "connect-src 'self' https://*.pusher.com wss://*.pusher.com https://res.cloudinary.com https://*.clerk.com https://*.clerk.accounts.dev",
    "frame-src https://*.clerk.accounts.dev https://clerk.accounts.dev https://challenges.cloudflare.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '))
  return res
}

export default clerkMiddleware((auth, req) => {
  const { pathname } = req.nextUrl

  // Skip static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    /\.(png|jpg|jpeg|ico|svg|webp|json|txt|js|css|woff2?|ttf)$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  // Public routes — always allow
  if (isPublicRoute(req)) {
    return securityHeaders(NextResponse.next())
  }

  // Protected routes — require Clerk session
  if (isAdminRoute(req)) {
    const { userId } = auth()
    if (!userId) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const signInUrl = new URL('/sign-in', req.url)
      signInUrl.searchParams.set('redirect_url', req.url)
      return NextResponse.redirect(signInUrl)
    }
  }

  return securityHeaders(NextResponse.next())
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
