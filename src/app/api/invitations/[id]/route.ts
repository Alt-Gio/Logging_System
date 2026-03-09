export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const client = await clerkClient()
    await client.invitations.revokeInvitation(params.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[invitations/DELETE]', err)
    return NextResponse.json({ error: 'Failed to revoke invitation' }, { status: 500 })
  }
}
