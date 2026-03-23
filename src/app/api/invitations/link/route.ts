export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

// POST /api/invitations/link — create a temporary staff account with a one-time password
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const username    = `staff_${randomBytes(4).toString('hex')}`
    const tempPassword = randomBytes(8).toString('hex')
    const hash = await bcrypt.hash(tempPassword, 12)

    const record = await prisma.admin.create({
      data: { username, password: hash, name: 'New Staff', role: 'STAFF' },
      select: { id: true, createdAt: true },
    })

    const url = `${process.env.NEXTAUTH_URL || ''}/sign-in?hint=${username}`

    return NextResponse.json({
      invitation: {
        id:           record.id,
        emailAddress: null,
        status:       'pending',
        createdAt:    record.createdAt.toISOString(),
        url:          `${url}&pass=${tempPassword}`,
      }
    })
  } catch (err) {
    console.error('[invitations/link/POST]', err)
    return NextResponse.json({ error: 'Failed to generate invite link' }, { status: 500 })
  }
}
