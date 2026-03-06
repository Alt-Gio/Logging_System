// src/lib/auth.ts
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { prisma } from './prisma'

// ── Password hashing (bcrypt, cost factor 12) ─────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ── JWT (HMAC-SHA256 signed, not just base64) ─────────────────────────────────
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (secret && secret.length < 32 && process.env.NODE_ENV !== 'production') {
    console.warn('[Auth] JWT_SECRET is shorter than 32 characters. Use a longer secret in production.')
  }
  if (!secret) {
    // In production, this must be set. Crash loudly rather than use a known-public fallback.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is not set. Set a 32+ character random string.')
    }
    // Dev-only fallback — never reaches production
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
import * as crypto from 'crypto'
import { cookies } from 'next/headers'
import { prisma } from './prisma'

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export function generateToken(adminId: string): string {
  const payload = `${adminId}:${Date.now()}:${process.env.JWT_SECRET || 'dict-secret-2026'}`
  return Buffer.from(payload).toString('base64')
}

export function verifyToken(token: string): { adminId: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const [adminId, timestamp] = decoded.split(':')

    // Token expires in 8 hours
    const age = Date.now() - parseInt(timestamp)
    if (age > 8 * 60 * 60 * 1000) return null

    return { adminId }
  } catch {
    return null
  }
}

// ── Session (reads cookie, returns admin record) ──────────────────────────────
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

// ── Request-level auth (for API routes) ──────────────────────────────────────
export async function requireAuth(req: NextRequest): Promise<{ id: string; username: string; name: string; role: string } | null> {
  // 1. Cookie (browser session)
  const cookieHeader = req.headers.get('cookie') || ''
  const tokenMatch = cookieHeader.match(/auth_token=([^;]+)/)
  const cookieToken = tokenMatch?.[1]

  // 2. Bearer header (API / programmatic access)
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

// ── In-memory rate limiter (resets on server restart — good enough for Railway) ─
const loginAttempts = new Map<string, { count: number; firstAt: number; lockedUntil?: number }>()
const MAX_ATTEMPTS   = 5
const WINDOW_MS      = 10 * 60 * 1000  // 10 minutes
const LOCKOUT_MS     = 15 * 60 * 1000  // 15 minutes lockout

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const rec = loginAttempts.get(ip)

  if (!rec) {
    loginAttempts.set(ip, { count: 0, firstAt: now })
    return { allowed: true }
  }

  // Currently locked out?
  if (rec.lockedUntil && now < rec.lockedUntil) {
    return { allowed: false, retryAfter: Math.ceil((rec.lockedUntil - now) / 1000) }
  }

  // Window expired — reset
  if (now - rec.firstAt > WINDOW_MS) {
    loginAttempts.set(ip, { count: 0, firstAt: now })
    return { allowed: true }
  }

  return { allowed: true }
}

export function recordFailedLogin(ip: string) {
  const now = Date.now()
  const rec = loginAttempts.get(ip) ?? { count: 0, firstAt: now }
  rec.count++
  if (rec.count >= MAX_ATTEMPTS) rec.lockedUntil = now + LOCKOUT_MS
  loginAttempts.set(ip, rec)
}

export function clearLoginAttempts(ip: string) {
  loginAttempts.delete(ip)
}

// ── General API rate limiter ──────────────────────────────────────────────────
const apiHits = new Map<string, { count: number; resetAt: number }>()

export function checkApiRateLimit(key: string, maxPerMin = 60): boolean {
  const now = Date.now()
  const rec = apiHits.get(key)
  if (!rec || now > rec.resetAt) {
    apiHits.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (rec.count >= maxPerMin) return false
  rec.count++
  return true
export async function getSession() {
  const cookieStore = cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return null

  const decoded = verifyToken(token)
  if (!decoded) return null

  const admin = await prisma.admin.findUnique({
    where: { id: decoded.adminId },
    select: { id: true, username: true, name: true, role: true },
  })

  return admin
}
