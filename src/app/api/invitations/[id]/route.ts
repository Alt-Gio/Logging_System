export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const convex = getConvexClient()
    await convex.mutation(api.admins.remove, { id: params.id as Id<'admins'> })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[invitations/DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
