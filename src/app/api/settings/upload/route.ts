export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

/**
 * In Docker, Convex's generateUploadUrl() returns a URL using the public
 * hostname (e.g. https://dict.it.com). Replace the origin with the internal
 * CONVEX_URL so the upload stays within the Docker network.
 */
function toInternalUrl(convexGeneratedUrl: string): string {
  const base = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL
  if (!base) return convexGeneratedUrl
  try {
    const b = new URL(base)
    const u = new URL(convexGeneratedUrl, b.origin)
    u.protocol = b.protocol
    u.hostname  = b.hostname
    u.port      = b.port || ''
    return u.toString()
  } catch {
    return convexGeneratedUrl
  }
}

function toPublicUrl(storageUrl: string): string {
  const pub = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!pub) return storageUrl
  try {
    const p = new URL(pub)
    const u = new URL(storageUrl)
    u.protocol = p.protocol
    u.hostname  = p.hostname
    u.port      = p.port || ''
    return u.toString()
  } catch {
    return storageUrl
  }
}

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB — hero images/videos can be large

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file || file.size === 0)
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    if (file.size > MAX_BYTES)
      return NextResponse.json({ error: 'File too large — maximum is 50 MB' }, { status: 413 })

    const convex = getConvexClient()

    // 1. Get a signed upload URL from Convex
    const rawUrl    = await convex.mutation(api.settings.generateUploadUrl, {})
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
        `[settings/upload] Convex storage rejected upload — HTTP ${storageRes.status}`,
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
      console.error('[settings/upload] No storageId in Convex response:', json)
      return NextResponse.json(
        { error: 'Upload succeeded but Convex did not return a storageId' },
        { status: 502 },
      )
    }

    // 3. Resolve storageId → public URL and save to settings
    const mediaType = contentType.startsWith('video/') ? 'video' : 'image'
    const rawStorageUrl = await convex.mutation(api.settings.saveMediaUrl, {
      storageId: storageId as Id<'_storage'>,
      mediaType,
    })
    const url = toPublicUrl(rawStorageUrl)

    return NextResponse.json({ url, mediaType })
  } catch (err: any) {
    console.error('[settings/upload] unexpected error:', err?.message ?? err)
    return NextResponse.json({ error: err?.message ?? 'Upload failed' }, { status: 500 })
  }
}
