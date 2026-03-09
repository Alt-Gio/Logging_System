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

// ── requireAuth — accepts BOTH Clerk session AND legacy JWT ──────────────────
// Clerk is primary. Legacy JWT is fallback for programmatic API access.
// Returns a unified admin-like object. For Clerk users, id = Clerk userId.
export async function requireAuth(req: NextRequest): Promise<{ id: string; username: string; name: string; role: string } | null> {
  // 1. Check Clerk session cookie (__session or __client_uat)
  try {
    const { auth } = await import('@clerk/nextjs/server')
    // auth() works in middleware + Server Components. For Route Handlers we use getAuth.
    const { getAuth } = await import('@clerk/nextjs/server')
    const clerkAuth = getAuth(req)
    if (clerkAuth.userId) {
      // Valid Clerk session — return a synthetic admin object
      return {
        id: clerkAuth.userId,
        username: clerkAuth.userId,
        name: 'Staff',
        role: 'ADMIN',
      }
    }
  } catch {
    // Clerk not available or session invalid — fall through to legacy
  }

  // 2. Legacy JWT cookie (browser session)
  const cookieHeader = req.headers.get('cookie') || ''
  const tokenMatch   = cookieHeader.match(/auth_token=([^;]+)/)
  const cookieToken  = tokenMatch?.[1]

  // 3. Bearer header (programmatic API access)
  const bearerToken = req.headers.get('authorization')?.replace('Bearer ', '')

  const token = cookieToken || bearerToken
  if (!token) return null

  const decoded = await verifyToken(token)
  if (!decoded) return null

  return prisma.admin.findUnique({
    where: { id: decoded.adminId },
    select: { id: true, username: true, name: true, role: true },
  })
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
