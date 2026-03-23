export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

// POST /api/invitations — create admin account(s) directly (invite-by-account)
export async function POST(req: NextRequest) {
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { emails } = await req.json()
  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'No usernames provided' }, { status: 400 })
  }

  try {
    const created = await Promise.all(
      emails.map(async (username: string) => {
        const tempPassword = randomBytes(8).toString('hex')
        const hash = await bcrypt.hash(tempPassword, 12)
        const record = await prisma.admin.create({
          data: { username, password: hash, name: username, role: 'STAFF' },
          select: { id: true, username: true, name: true, role: true, createdAt: true },
        })
        return {
          id:           record.id,
          emailAddress: record.username,
          status:       'pending' as const,
          createdAt:    record.createdAt.toISOString(),
          tempPassword,
        }
      })
    )
    return NextResponse.json({ invitations: created })
  } catch (err) {
    console.error('[invitations/POST]', err)
    return NextResponse.json({ error: 'Failed to create accounts' }, { status: 500 })
  }
}

// GET /api/invitations — list all admin accounts as "invitations"
export async function GET(req: NextRequest) {
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const admins = await prisma.admin.findMany({
      select: { id: true, username: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({
      invitations: admins.map(a => ({
        id:           a.id,
        emailAddress: a.username,
        status:       'accepted' as const,
        createdAt:    a.createdAt.toISOString(),
      }))
    })
  } catch (err) {
    console.error('[invitations/GET]', err)
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}
