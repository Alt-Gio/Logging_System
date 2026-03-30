export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const convex = getConvexClient()

    // 1. Generate upload URL (server-side)
    const uploadUrl = await convex.mutation(api.settings.generateUploadUrl, {})

    // 2. Upload file bytes from server to Convex storage
    const bytes = await file.arrayBuffer()
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: bytes,
    })
    if (!uploadRes.ok) {
      const text = await uploadRes.text()
      console.error('[settings/upload] Convex storage upload failed:', text)
      return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 })
    }
    const { storageId } = await uploadRes.json() as { storageId: string }

    // 3. Resolve storage ID to public URL and persist to settings
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image'
    const url = await convex.mutation(api.settings.saveMediaUrl, {
      storageId: storageId as Id<'_storage'>,
      mediaType,
    })

    return NextResponse.json({ url, mediaType })
  } catch (e) {
    console.error('[settings/upload]', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
