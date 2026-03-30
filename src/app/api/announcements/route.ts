export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

// GET — active announcements by default; pass ?all=1 to return all (for admin)
export async function GET(req: NextRequest) {
  try {
    const all = new URL(req.url).searchParams.get('all') === '1'
    const convex = getConvexClient()
    const announcements = all
      ? await convex.query(api.announcements.getAll, {})
      : await convex.query(api.announcements.getActive, {})
    return NextResponse.json(announcements.map(a => ({
      id:            a._id,
      title:         a.title,
      content:       a.body,
      type:          a.type,
      urgent:        a.type === 'WARNING' || a.type === 'MAINTENANCE',
      createdAt:     new Date(a._creationTime).toISOString(),
      expiresAt:     a.expiresAt ? new Date(a.expiresAt).toISOString() : undefined,
      imageUrl:      a.imageUrl,
      featured:      a.featured,
      highlight:     a.highlight,
      featuredOrder: a.featuredOrder,
      tags:          a.tags,
    })))
  } catch (err) {
    console.error('[announcements/GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const convex = getConvexClient()
    const id = await convex.mutation(api.announcements.create, {
      title:          body.title,
      body:           body.body ?? body.content ?? '',
      type:           body.type  ?? 'INFO',
      active:         body.active ?? true,
      dateStart:      body.dateStart ? new Date(body.dateStart).getTime() : undefined,
      dateEnd:        body.dateEnd   ? new Date(body.dateEnd).getTime()   : undefined,
      expiresAt:      body.expiresAt ? new Date(body.expiresAt).getTime() : undefined,
      createdBy:      admin.name,
      imageUrl:       body.imageUrl,
      imageStorageId: body.imageStorageId,
      featured:       body.featured,
      highlight:      body.highlight,
      featuredOrder:  body.featuredOrder,
      tags:           body.tags,
    })
    return NextResponse.json({ _id: id }, { status: 201 })
  } catch (err) {
    console.error('[announcements/POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
