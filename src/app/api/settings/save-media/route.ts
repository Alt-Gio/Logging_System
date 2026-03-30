export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export async function POST(req: NextRequest) {
  try {
    const { storageId, mediaType } = await req.json()
    if (!storageId || !mediaType) return NextResponse.json({ error: 'Missing storageId or mediaType' }, { status: 400 })
    const convex = getConvexClient()
    const url = await convex.mutation(api.settings.saveMediaUrl, {
      storageId: storageId as Id<'_storage'>,
      mediaType: mediaType as 'image' | 'video',
    })
    return NextResponse.json({ url })
  } catch (e) {
    console.error('[settings/save-media]', e)
    return NextResponse.json({ error: 'Failed to save media' }, { status: 500 })
  }
}
