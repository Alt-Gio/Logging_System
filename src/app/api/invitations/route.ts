export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

// POST /api/invitations — create admin account(s) directly (invite-by-account)
export async function POST(req: NextRequest) {
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { emails } = await req.json()
  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'No usernames provided' }, { status: 400 })
  }

  try {
    const convex  = getConvexClient()
    const created = await Promise.all(
      emails.map(async (username: string) => {
        const tempPassword = randomBytes(8).toString('hex')
        const hash = await bcrypt.hash(tempPassword, 12)
        const id = await convex.mutation(api.admins.create, {
          username: username.trim().toLowerCase(),
          passwordHash: hash,
          name: username,
          role: 'STAFF',
        })
        return {
          id,
          emailAddress: username,
          status:       'pending' as const,
          createdAt:    new Date().toISOString(),
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
    const convex = getConvexClient()
    const admins  = await convex.query(api.admins.getAll)
    return NextResponse.json({
      invitations: admins.map(a => ({
        id:           a.id,
        emailAddress: a.username,
        status:       'accepted' as const,
        createdAt:    new Date(a.lastLoginAt ?? 0).toISOString(),
      }))
    })
  } catch (err) {
    console.error('[invitations/GET]', err)
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}
