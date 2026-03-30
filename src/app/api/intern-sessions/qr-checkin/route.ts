export const dynamic = 'force-dynamic'
/**
 * POST /api/intern-sessions/qr-checkin
 * Body: { token, lat, lng, email?, password? }
 *
 * 1. Validates the daily QR token (HMAC-based, only valid today)
 * 2. Validates GPS is within allowed radius of the DTC office
 * 3. Authenticates the intern (via active cookie session OR email+password)
 * 4. Creates a time-in session with method="qr_location"
 */
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'
import bcrypt from 'bcryptjs'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { verifyDailyToken } from '@/lib/qr-token'

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-fallback-secret-change-me-00000')
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R  = 6_371_000
  const d1 = (lat2 - lat1) * Math.PI / 180
  const d2 = (lng2 - lng1) * Math.PI / 180
  const a  = Math.sin(d1 / 2) ** 2 +
             Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(d2 / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, lat, lng, email, password } = body as {
      token: string
      lat?: number
      lng?: number
      email?: string
      password?: string
    }

    if (!token) return NextResponse.json({ error: 'QR token required' }, { status: 400 })

    // ── 1. Validate daily token ─────────────────────────────────────────────
    const tokenOk = await verifyDailyToken(token)
    if (!tokenOk) {
      return NextResponse.json({ error: 'QR code has expired or is invalid. Please scan today\'s code.' }, { status: 401 })
    }

    // ── 2. Validate GPS location ───────────────────────────────────────────
    const convex      = getConvexClient()
    const allSettings = await convex.query(api.settings.getAll, {})
    const cfg: Record<string, string> = {}
    for (const s of allSettings) cfg[s.key] = s.value

    const officeLat = parseFloat(cfg.office_lat ?? '13.1391')
    const officeLng = parseFloat(cfg.office_lng ?? '123.7438')
    const radiusM   = parseInt(cfg.checkin_radius_m ?? '300', 10)

    let distanceM: number | null = null
    let locationVerified = false
    if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
      distanceM       = Math.round(haversineMeters(lat, lng, officeLat, officeLng))
      locationVerified = distanceM <= radiusM
      if (!locationVerified) {
        return NextResponse.json({
          error: `You are ${distanceM}m away from the DTC office. You must be within ${radiusM}m to check in via QR.`,
          distanceM,
          radiusM,
        }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: 'GPS location is required for QR check-in.' }, { status: 400 })
    }

    // ── 3. Authenticate intern ─────────────────────────────────────────────
    let internId: string | null = null
    let accountId: string | null = null
    let internName: string | null = null
    let accountEmail: string | null = null

    // Check existing session cookie
    const cookieToken = req.cookies.get('intern-session')?.value
    if (cookieToken) {
      try {
        const { payload } = await jwtVerify(cookieToken, getSecret())
        if (payload.role === 'INTERN') {
          internId    = payload.internId as string
          accountId   = payload.id as string
          internName  = payload.name as string
          accountEmail = payload.email as string
        }
      } catch { /* invalid cookie — fall through to credential auth */ }
    }

    // If no valid session, try email+password
    if (!internId && email && password) {
      const account = await convex.query(api.internAccounts.getByEmail, { email: email.toLowerCase().trim() })
      if (!account) return NextResponse.json({ error: 'No account found with that email' }, { status: 401 })
      if (!account.emailVerified) return NextResponse.json({ error: 'Email not verified' }, { status: 403 })
      const ok = await bcrypt.compare(password, account.passwordHash)
      if (!ok) return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
      const intern = await convex.query(api.interns.getById, { id: account.internId })
      if (!intern) return NextResponse.json({ error: 'Intern profile not found' }, { status: 404 })
      internId    = account.internId
      accountId   = account._id
      internName  = intern.fullName
      accountEmail = account.email
    }

    if (!internId) {
      return NextResponse.json({ error: 'Authentication required. Please log in or provide email & password.' }, { status: 401 })
    }

    // ── 4. Create time-in session ──────────────────────────────────────────
    const sessionId = await convex.mutation(api.internSessions.timeIn, {
      internId:      internId as Id<'interns'>,
      checkInMethod: 'qr_location',
      checkInLat:    lat,
      checkInLng:    lng,
    })

    // If authenticated via credentials, also issue a new session cookie
    const response = NextResponse.json({
      ok:           true,
      sessionId,
      internId,
      internName,
      distanceM,
      checkInMethod: 'qr_location',
      timeIn:        new Date().toISOString(),
    }, { status: 201 })

    if (!cookieToken && accountId && internName && accountEmail) {
      const jwt = await new SignJWT({
        id:       accountId,
        internId,
        email:    accountEmail,
        name:     internName,
        role:     'INTERN',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(getSecret())

      response.cookies.set('intern-session', jwt, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   60 * 60 * 24,
        path:     '/',
      })
    }

    return response
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('already active')) return NextResponse.json({ error: 'You already have an active session.' }, { status: 409 })
    console.error('[qr-checkin]', e)
    return NextResponse.json({ error: 'Check-in failed. Please try again.' }, { status: 500 })
  }
}
