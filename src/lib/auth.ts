// src/lib/auth.ts
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
