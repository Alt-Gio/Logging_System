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

async function getInternSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('intern-session')?.value
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload.role === 'INTERN'
  } catch { return false }
}

async function getSupervisorSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('supervisor-session')?.value
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload.role === 'SUPERVISOR'
  } catch { return false }
}

const PUBLIC_PATHS = [
  '/',
  '/sign-in',
  '/setup',
  '/rules',
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
  '/api/otp',
  '/api/intern-auth',
  '/api/supervisor-auth',
  '/api/notifications',
  '/intern-logbook',
  '/intern/login',
  '/intern/setup',
  '/supervisor/login',
  '/supervisor/setup',
  '/dtc-logbook',
  '/intern/dashboard',
  '/supervisor/intern',

]

const INTERN_PATHS = [
  
  '/intern/tasks',
  '/intern/leaderboard',
]

const SUPERVISOR_PATHS = [
  '/supervisor/dashboard',
  '/supervisor/intern',
]

function isInternPath(pathname: string): boolean {
  return INTERN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

function isSupervisorPath(pathname: string): boolean {
  return SUPERVISOR_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

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
  '/intern/dashboard',
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
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://res.cloudinary.com https://api.qrserver.com",
    "connect-src 'self' https://res.cloudinary.com https://api.groq.com wss://localhost:3210 ws://localhost:3210",
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

  // Protected paths are checked BEFORE public paths to prevent prefix leakage
  if (isInternPath(pathname)) {
    const ok = await getInternSession(req)
    if (!ok) {
      const loginUrl = new URL('/intern/login', req.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return applySecurityHeaders(NextResponse.next())
  }

  if (isSupervisorPath(pathname)) {
    const ok = await getSupervisorSession(req)
    if (!ok) {
      const loginUrl = new URL('/supervisor/login', req.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return applySecurityHeaders(NextResponse.next())
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
      const cb = req.nextUrl.pathname + (req.nextUrl.search || '')
      signInUrl.searchParams.set('callbackUrl', cb)
      return NextResponse.redirect(signInUrl)
    }
  }

  return applySecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
