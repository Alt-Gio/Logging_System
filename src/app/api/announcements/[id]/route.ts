export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const convex = getConvexClient()
    await convex.mutation(api.announcements.update, {
      id:             params.id as Id<'announcements'>,
      title:          body.title,
      body:           body.body ?? body.content,
      active:         body.active,
      type:           body.type,
      dateStart:      body.dateStart ? new Date(body.dateStart).getTime() : undefined,
      dateEnd:        body.dateEnd   ? new Date(body.dateEnd).getTime()   : undefined,
      expiresAt:      body.expiresAt ? new Date(body.expiresAt).getTime() : undefined,
      imageUrl:       body.imageUrl,
      imageStorageId: body.imageStorageId,
      featured:       body.featured,
      highlight:      body.highlight,
      featuredOrder:  body.featuredOrder,
      tags:           body.tags,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[announcements/PATCH]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const convex = getConvexClient()
    await convex.mutation(api.announcements.remove, { id: params.id as Id<'announcements'> })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[announcements/DELETE]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
