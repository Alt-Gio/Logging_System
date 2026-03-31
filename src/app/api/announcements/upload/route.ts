export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

/**
 * In Docker, Convex's generateUploadUrl() returns a URL using the public
 * hostname (e.g. https://dict.it.com). But the Next.js container can only
 * reach Convex via the internal Docker hostname in CONVEX_URL.
 * Replace the origin so the upload stays inside the Docker network.
 */
function toInternalUrl(convexGeneratedUrl: string): string {
  const base = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL
  if (!base) return convexGeneratedUrl
  try {
    const b = new URL(base)
    // new URL(url, base) handles both absolute and relative URLs correctly
    const u = new URL(convexGeneratedUrl, b.origin)
    u.protocol = b.protocol
    u.hostname  = b.hostname
    u.port      = b.port || ''
    return u.toString()
  } catch {
    return convexGeneratedUrl
  }
}

const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file || file.size === 0)
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    if (file.size > MAX_BYTES)
      return NextResponse.json({ error: 'File too large — maximum is 20 MB' }, { status: 413 })

    const convex = getConvexClient()

    // 1. Get a signed upload URL from Convex
    const rawUrl    = await convex.mutation(api.announcements.generateImageUploadUrl, {})
    const uploadUrl = toInternalUrl(rawUrl)

    // 2. POST file bytes directly to Convex storage (server → Convex within Docker)
    const contentType = file.type || 'application/octet-stream'
    const bytes       = await file.arrayBuffer()

    const storageRes = await fetch(uploadUrl, {
      method:  'POST',
      headers: { 'Content-Type': contentType },
      body:    bytes,
    })

    if (!storageRes.ok) {
      const detail = await storageRes.text().catch(() => '')
      console.error(
        `[announcements/upload] Convex storage rejected upload — HTTP ${storageRes.status}`,
        '| url:', uploadUrl,
        '| body:', detail.slice(0, 300),
      )
      return NextResponse.json(
        { error: `Storage upload failed (HTTP ${storageRes.status}). Check server logs.` },
        { status: 502 },
      )
    }

    const json = await storageRes.json().catch(() => ({}))
    const storageId: string | undefined = json?.storageId
    if (!storageId) {
      console.error('[announcements/upload] No storageId in Convex response:', json)
      return NextResponse.json(
        { error: 'Upload succeeded but Convex did not return a storageId' },
        { status: 502 },
      )
    }

    // 3. Resolve storageId → public CDN URL
    const url = await convex.mutation(api.announcements.resolveStorageUrl, { storageId })

    return NextResponse.json({ url, storageId })
  } catch (err: any) {
    console.error('[announcements/upload] unexpected error:', err?.message ?? err)
    return NextResponse.json({ error: err?.message ?? 'Upload failed' }, { status: 500 })
  }
}
