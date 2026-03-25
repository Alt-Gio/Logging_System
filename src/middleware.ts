import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

function getSecret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET ?? 'dev-fallback-secret-change-me-00000',
  )
}

async function getSessionUserId(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get('dict-session')?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return (payload.id as string) ?? null
  } catch {
    return null
  }
}

const PUBLIC_PATHS = [
  '/',
  '/sign-in',
  '/setup',
  '/print',
  '/offline',
  '/api/health',
  '/api/auth',
  '/api/setup',
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
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  res.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=()')
  res.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.pusher.com https://challenges.cloudflare.com blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://res.cloudinary.com https://api.qrserver.com",
    "connect-src 'self' https://*.pusher.com wss://*.pusher.com https://res.cloudinary.com https://api.groq.com wss://localhost:3210 ws://localhost:3210",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '))
  return res
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

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

  if (isAdmin(pathname)) {
    const userId = await getSessionUserId(req)
    if (!userId) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const signInUrl = new URL('/sign-in', req.url)
      signInUrl.searchParams.set('callbackUrl', req.url)
      return NextResponse.redirect(signInUrl)
    }
  }

  return applySecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
