export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

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

const MAX_BYTES = 100 * 1024 * 1024 // 100 MB — videos can be large

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file || file.size === 0)
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    if (file.size > MAX_BYTES)
      return NextResponse.json({ error: 'File too large — maximum is 100 MB' }, { status: 413 })

    const convex = getConvexClient()

    const rawUrl    = await convex.mutation(api.heroSlides.generateUploadUrl, {})
    const uploadUrl = toInternalUrl(rawUrl)

    const contentType = file.type || 'application/octet-stream'
    const bytes       = await file.arrayBuffer()

    const storageRes = await fetch(uploadUrl, {
      method:  'POST',
      headers: { 'Content-Type': contentType },
      body:    bytes,
    })

    if (!storageRes.ok) {
      const detail = await storageRes.text().catch(() => '')
      console.error('[hero-slides/upload] Storage error:', storageRes.status, detail.slice(0, 300))
      return NextResponse.json({ error: `Storage upload failed (HTTP ${storageRes.status})` }, { status: 502 })
    }

    const json = await storageRes.json().catch(() => ({}))
    const storageId: string | undefined = json?.storageId
    if (!storageId)
      return NextResponse.json({ error: 'No storageId returned' }, { status: 502 })

    const rawStorageUrl = await convex.mutation(api.heroSlides.resolveStorageUrl, { storageId })
    const url = toPublicUrl(rawStorageUrl)
    const mediaType = contentType.startsWith('video/') ? 'video' : 'image'

    return NextResponse.json({ url, storageId, mediaType })
  } catch (err: any) {
    console.error('[hero-slides/upload] error:', err?.message ?? err)
    return NextResponse.json({ error: err?.message ?? 'Upload failed' }, { status: 500 })
  }
}
