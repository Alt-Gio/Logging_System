export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

type FBPost = {
  id: string
  message?: string
  story?: string
  created_time: string
  full_picture?: string
  permalink_url?: string
}

// Simple server-side 5-minute cache
let _cache: { posts: FBPost[]; at: number } | null = null
const TTL = 5 * 60 * 1000

export async function GET() {
  try {
    if (_cache && Date.now() - _cache.at < TTL) {
      return NextResponse.json(_cache.posts)
    }

    const convex = getConvexClient()
    const rows   = await convex.query(api.settings.getAll, {})
    const s      = Object.fromEntries(rows.map(r => [r.key, r.value]))

    const pageId = s.facebook_page_id?.trim()
    const token  = s.facebook_access_token?.trim()

    if (!pageId || !token) return NextResponse.json([])

    const fields = 'id,message,story,created_time,full_picture,permalink_url'
    const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}/posts?fields=${fields}&limit=12&access_token=${token}`

    const res = await fetch(url, { cache: 'no-store' })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[facebook/posts] Graph API error:', JSON.stringify(err))
      return NextResponse.json([])
    }

    const data = await res.json() as { data?: FBPost[] }
    const posts = (data.data ?? []).filter(p => p.message || p.story)

    _cache = { posts, at: Date.now() }
    return NextResponse.json(posts)
  } catch (e) {
    console.error('[facebook/posts]', e)
    return NextResponse.json([])
  }
}
