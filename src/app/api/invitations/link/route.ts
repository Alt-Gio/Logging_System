export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Generate a one-time invite link with no specific email
    const client = await clerkClient()
    const token  = await client.signInTokens.createSignInToken({
      userId,
      expiresInSeconds: 60 * 60 * 24 * 7, // 7 days
    })

    const url = `${process.env.NEXT_PUBLIC_APP_URL || ''}/sign-in?__clerk_ticket=${token.token}`

    return NextResponse.json({
      invitation: {
        id:           token.id,
        emailAddress: null,
        status:       'pending',
        createdAt:    new Date().toISOString(),
        url,
      }
    })
  } catch (err) {
    console.error('[invitations/link/POST]', err)
    return NextResponse.json({ error: 'Failed to generate invite link' }, { status: 500 })
  }
}
