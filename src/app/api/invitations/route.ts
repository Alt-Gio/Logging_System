export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { emails } = await req.json()
    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'No emails provided' }, { status: 400 })
    }

    const client = await clerkClient()
    const invitations = await Promise.all(
      emails.map((emailAddress: string) =>
        client.invitations.createInvitation({
          emailAddress,
          redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/admin`,
          notify: true,
        })
      )
    )

    return NextResponse.json({
      invitations: invitations.map(inv => ({
        id:           inv.id,
        emailAddress: inv.emailAddress,
        status:       inv.status,
        createdAt:    inv.createdAt,
      }))
    })
  } catch (err) {
    console.error('[invitations/POST]', err)
    return NextResponse.json({ error: 'Failed to create invitations' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const client = await clerkClient()
    const result = await client.invitations.getInvitationList({ status: 'pending' })

    return NextResponse.json({
      invitations: result.data.map(inv => ({
        id:           inv.id,
        emailAddress: inv.emailAddress,
        status:       inv.status,
        createdAt:    inv.createdAt,
      }))
    })
  } catch (err) {
    console.error('[invitations/GET]', err)
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 })
  }
}
