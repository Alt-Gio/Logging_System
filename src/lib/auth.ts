// src/lib/auth.ts
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { prisma } from './prisma'

// ── Password hashing ──────────────────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ── JWT (legacy, kept for API tokens) ────────────────────────────────────────
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      // Non-fatal now — Clerk is primary auth
      return new TextEncoder().encode('clerk-is-primary-auth-fallback-00')
    }
    return new TextEncoder().encode('dev-only-not-for-production-0000000')
  }
  return new TextEncoder().encode(secret)
}

export async function generateToken(adminId: string, role: string): Promise<string> {
  return new SignJWT({ sub: adminId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getJwtSecret())
}

export async function verifyToken(token: string): Promise<{ adminId: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return { adminId: payload.sub as string, role: payload.role as string }
  } catch {
    return null
  }
}

// ── Session (reads cookie) ────────────────────────────────────────────────────
export async function getSession() {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get('auth_token')?.value
    if (!token) return null
    const decoded = await verifyToken(token)
    if (!decoded) return null
    return await prisma.admin.findUnique({
      where: { id: decoded.adminId },
      select: { id: true, username: true, name: true, role: true },
    })
  } catch {
    return null
  }
}

// ── requireAuth — stateless JWT verification (no DB lookup needed) ────────────
// JWT payload already contains all necessary fields set at login time.
export async function requireAuth(req: NextRequest): Promise<{ id: string; username: string; name: string; role: string } | null> {
  const mainSecret = new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-fallback-secret-change-me-00000')

  // 1. dict-session cookie (primary — set by /api/auth/login)
  try {
    const raw = req.cookies.get('dict-session')?.value
    if (raw) {
      const { payload } = await jwtVerify(raw, mainSecret)
      if (payload.id && payload.email) {
        return {
          id:       payload.id       as string,
          username: payload.email    as string,
          name:     (payload.name    as string) ?? '',
          role:     (payload.role    as string) ?? 'STAFF',
        }
      }
    }
  } catch { /* fall through */ }

  // 2. Legacy Bearer header / auth_token cookie (programmatic access)
  const bearerToken = req.headers.get('authorization')?.replace('Bearer ', '')
  const cookieToken = req.headers.get('cookie')?.match(/auth_token=([^;]+)/)?.[1]
  const legacyToken = bearerToken || cookieToken
  if (!legacyToken) return null

  const decoded = await verifyToken(legacyToken)
  if (!decoded) return null

  // Legacy tokens don't carry name — fetch from Convex if available
  try {
    const { getConvexClient } = await import('./convex-client')
    const { api }             = await import('@/convex/_generated/api')
    const admin = await getConvexClient().query(api.admins.getById, {
      id: decoded.adminId as import('@/convex/_generated/dataModel').Id<'admins'>,
    })
    if (admin) return { id: admin._id, username: admin.username, name: admin.name, role: admin.role }
  } catch { /* fall through */ }

  return { id: decoded.adminId, username: decoded.adminId, name: '', role: decoded.role }
}

// ── Rate limiters ─────────────────────────────────────────────────────────────
const loginAttempts = new Map<string, { count: number; firstAt: number; lockedUntil?: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS    = 10 * 60 * 1000
const LOCKOUT_MS   = 15 * 60 * 1000

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const rec = loginAttempts.get(ip)
  if (!rec) { loginAttempts.set(ip, { count: 0, firstAt: now }); return { allowed: true } }
  if (rec.lockedUntil && now < rec.lockedUntil) return { allowed: false, retryAfter: Math.ceil((rec.lockedUntil - now) / 1000) }
  if (now - rec.firstAt > WINDOW_MS) { loginAttempts.set(ip, { count: 0, firstAt: now }); return { allowed: true } }
  return { allowed: true }
}
export function recordFailedLogin(ip: string) {
  const now = Date.now()
  const rec = loginAttempts.get(ip) ?? { count: 0, firstAt: now }
  rec.count++
  if (rec.count >= MAX_ATTEMPTS) rec.lockedUntil = now + LOCKOUT_MS
  loginAttempts.set(ip, rec)
}
export function clearLoginAttempts(ip: string) { loginAttempts.delete(ip) }

const apiHits = new Map<string, { count: number; resetAt: number }>()
export function checkApiRateLimit(key: string, maxPerMin = 60): boolean {
  const now = Date.now()
  const rec = apiHits.get(key)
  if (!rec || now > rec.resetAt) { apiHits.set(key, { count: 1, resetAt: now + 60_000 }); return true }
  if (rec.count >= maxPerMin) return false
  rec.count++
  return true
}
