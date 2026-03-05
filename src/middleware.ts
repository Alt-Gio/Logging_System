// src/middleware.ts — runs on EVERY request before page/API handlers
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

// Routes that are PUBLIC (no auth needed)
const PUBLIC_API = [
  '/api/auth',            // login/logout
  '/api/health',          // Railway healthcheck — always public
  '/api/settings',        // front page reads settings (GET only — write protected inside)
  '/api/pcs',             // front page reads PCs for selection (GET only)
  '/api/cron',            // cron uses its own secret
  '/api/announcements',   // front page reads announcements (GET only)
]

// Routes where POST is public (client submissions) but all other methods require auth
const PUBLIC_POST_ONLY = [
  '/api/logs',  // clients submit (POST), GET is public for print page summary only
]

const PUBLIC_PAGES = [
  '/',          // client logbook
  '/print',     // print report (read-only)
]

// Security headers applied to every response
function addSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'SAMEORIGIN')
  res.headers.set('X-XSS-Protection', '1; mode=block')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=self, microphone=()')
  // Content Security Policy — restricts resource loading to known origins
  res.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.pusher.com",  // unsafe-eval needed for Next.js dev
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com https://api.qrserver.com",
    "connect-src 'self' https://*.pusher.com wss://*.pusher.com https://res.cloudinary.com",
    "font-src 'self'",
    "frame-ancestors 'self'",   // prevents clickjacking more strictly than X-Frame-Options
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '))
  return res
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always add security headers
  const res = NextResponse.next()
  addSecurityHeaders(res)

  // Static files, _next internals — skip auth
  if (pathname.startsWith('/_next') || pathname.startsWith('/static') ||
      pathname.match(/\.(png|jpg|ico|svg|webp|json|txt)$/)) {
    return res
  }

  // Public pages
  if (PUBLIC_PAGES.some(p => pathname === p || pathname.startsWith(p + '?'))) {
    return res
  }

  // Public API routes — method-aware gating
  const isPublicApi = PUBLIC_API.some(p => pathname.startsWith(p))
  if (isPublicApi) {
    // PCs: only GET is public (POST/PATCH/DELETE require auth)
    if (pathname.startsWith('/api/pcs') && req.method !== 'GET') {
      // fall through to auth check
    }
    // Settings: only GET is public
    else if (pathname.startsWith('/api/settings') && req.method !== 'GET') {
      // fall through to auth check
    }
    // Announcements: only GET is public
    else if (pathname.startsWith('/api/announcements') && req.method !== 'GET') {
      // fall through to auth check
    }
    else {
      return res
    }
  }

  // /api/logs: POST is public (client submissions), GET public for summary
  // /api/logs/[id] PATCH/DELETE require auth
  const isPublicPost = PUBLIC_POST_ONLY.some(p => pathname.startsWith(p))
  if (isPublicPost) {
    // Only /api/logs (exact) or /api/logs?... for POST/GET
    const isExactLogsPath = pathname === '/api/logs' || pathname.startsWith('/api/logs?')
    const isLogsExport = pathname.startsWith('/api/logs/export')
    if ((isExactLogsPath && (req.method === 'POST' || req.method === 'GET')) || isLogsExport) {
      // Export requires auth — handled inside route handler
      if (!isLogsExport) return res
    }
    // /api/logs/[id]/... requires auth — fall through
  }

  // Everything else (/admin, /api/admin-logs, /api/cameras, /api/network,
  // /api/logs PATCH/DELETE, /api/pcs POST/PATCH/DELETE, etc.) requires auth
  const cookieToken = req.cookies.get('auth_token')?.value
  const bearerToken = req.headers.get('authorization')?.replace('Bearer ', '')
  const token = cookieToken || bearerToken

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return addSecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }
    // Redirect browser to login (admin page handles its own login UI)
    const url = req.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  const decoded = await verifyToken(token)
  if (!decoded) {
    if (pathname.startsWith('/api/')) {
      return addSecurityHeaders(NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }))
    }
    const url = req.nextUrl.clone()
    url.pathname = '/admin'
    const r = NextResponse.redirect(url)
    r.cookies.delete('auth_token')
    return r
  }

  // Inject admin id into request headers so API routes can read it
  const reqWithUser = NextResponse.next()
  reqWithUser.headers.set('x-admin-id', decoded.adminId)
  reqWithUser.headers.set('x-admin-role', decoded.role)
  addSecurityHeaders(reqWithUser)
  return reqWithUser
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
