export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function POST() {
  try {
    const convex = getConvexClient()
    const uploadUrl = await convex.mutation(api.settings.generateUploadUrl, {})
    return NextResponse.json({ uploadUrl })
  } catch (e) {
    console.error('[settings/upload]', e)
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
  }
}
