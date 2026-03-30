export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

// POST — public upload used during intern registration
// Returns { url, storageId } for the uploaded file.
// Admin-only access to view documents is enforced at the display layer.
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const convex  = getConvexClient()
    const uploadUrl = await convex.mutation(api.interns.generateUploadUrl, {})

    const bytes = await file.arrayBuffer()
    const uploadRes = await fetch(uploadUrl, {
      method:  'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body:    bytes,
    })
    if (!uploadRes.ok) {
      const text = await uploadRes.text()
      console.error('[interns/upload] Convex storage error:', text)
      return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 })
    }
    const { storageId } = await uploadRes.json() as { storageId: string }

    const url = await convex.mutation(api.interns.resolveUrl, { storageId })
    if (!url) return NextResponse.json({ error: 'Could not resolve storage URL' }, { status: 500 })

    return NextResponse.json({ url, storageId })
  } catch (e) {
    console.error('[interns/upload]', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
