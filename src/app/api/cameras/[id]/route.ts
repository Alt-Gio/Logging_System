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
    const data: Record<string, unknown> = {}
    if (body.name    !== undefined) data.name    = String(body.name).slice(0, 100)
    if (body.url     !== undefined) data.url     = body.url
    if (body.type    !== undefined) data.type    = body.type
    if (body.notes   !== undefined) data.notes   = body.notes
    if (body.enabled !== undefined) data.enabled = Boolean(body.enabled)

    const convex = getConvexClient()
    await convex.mutation(api.cameras.update, {
      id:      params.id as Id<'cameras'>,
      name:    data.name    as string | undefined,
      url:     data.url     as string | undefined,
      type:    data.type    as 'MJPEG' | 'SNAPSHOT' | 'HLS' | 'RTSP_PROXY' | undefined,
      notes:   data.notes   as string | undefined,
      enabled: data.enabled as boolean | undefined,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[cameras/PATCH]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const convex = getConvexClient()
    await convex.mutation(api.cameras.remove, { id: params.id as Id<'cameras'> })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[cameras/DELETE]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
