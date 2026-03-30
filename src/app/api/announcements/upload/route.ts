export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const convex = getConvexClient()

    // 1. Generate upload URL server-side
    const uploadUrl = await convex.mutation(api.announcements.generateImageUploadUrl, {})

    // 2. Stream file bytes from Next.js server to Convex storage
    const bytes = await file.arrayBuffer()
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'image/jpeg' },
      body: bytes,
    })
    if (!uploadRes.ok) {
      const text = await uploadRes.text()
      console.error('[announcements/upload] Storage upload failed:', text)
      return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 })
    }
    const { storageId } = await uploadRes.json() as { storageId: string }

    // 3. Get the public URL for this storage ID
    // We use a one-off query via the HTTP client to resolve the URL
    // by calling settings.generateUploadUrl trick — but actually we need
    // to store the storageId in a temp doc or resolve via a query.
    // The simplest approach: store storageId and resolve URL via a Convex query action.
    // However, getUrl requires a mutation/action context. We'll create a helper mutation.
    const url = await convex.mutation(api.announcements.resolveStorageUrl, {
      storageId,
    })

    return NextResponse.json({ url, storageId })
  } catch (e) {
    console.error('[announcements/upload]', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
