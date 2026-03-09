import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
// Required Railway env vars:
// NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY
// NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
// NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
// NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/admin
// NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/admin
import { NextResponse } from 'next/server'

// Routes that are always public (no Clerk auth needed)
const isPublicRoute = createRouteMatcher([
  '/',                        // client logbook front page
  '/print(.*)',               // print report
  '/api/health',              // Railway healthcheck
  '/api/auth(.*)',            // legacy JWT login (still used for API calls)
  '/api/settings(.*)',        // front page reads settings
  '/api/pcs(.*)',             // front page reads PCs
  '/api/cron(.*)',            // cron uses its own secret
  '/api/announcements(.*)',   // front page reads announcements
  '/api/logs',                // client log submissions
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/invite(.*)',
])

// API routes protected by Clerk
const isAdminApiRoute = createRouteMatcher([
  '/admin(.*)',
  '/api/admin-logs(.*)',
  '/api/admins(.*)',
  '/api/cameras(.*)',
  '/api/network(.*)',
  '/api/stats(.*)',
  '/api/logs/export(.*)',
  '/api/logs/(.+)',           // /api/logs/[id] — not bare /api/logs
])

function addSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'SAMEORIGIN')
  res.headers.set('X-XSS-Protection', '1; mode=block')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=self, microphone=()')
  res.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.pusher.com https://*.clerk.accounts.dev https://clerk.accounts.dev",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com https://api.qrserver.com https://img.clerk.com",
    "connect-src 'self' https://*.pusher.com wss://*.pusher.com https://res.cloudinary.com https://*.clerk.com https://*.clerk.accounts.dev",
    "font-src 'self'",
    "frame-src https://*.clerk.accounts.dev https://clerk.accounts.dev",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '))
  return res
}

export default clerkMiddleware(async (auth, req) => {
  const res = NextResponse.next()
  addSecurityHeaders(res)

  // Skip static files
  const { pathname } = req.nextUrl
  if (pathname.startsWith('/_next') || pathname.startsWith('/static') ||
      pathname.match(/\.(png|jpg|ico|svg|webp|json|txt|js|css)$/)) {
    return res
  }

  // Public routes — always allow
  if (isPublicRoute(req)) return res

  // Protected routes — require Clerk session
  if (isAdminApiRoute(req)) {
    const { userId } = await auth()
    if (!userId) {
      if (pathname.startsWith('/api/')) {
        return addSecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
      }
      // Redirect to Clerk sign-in for browser requests
      const signInUrl = new URL('/sign-in', req.url)
      signInUrl.searchParams.set('redirect_url', req.url)
      return NextResponse.redirect(signInUrl)
    }
  }

  return res
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
