export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

// Public GET — active announcements (client pages use useQuery directly; this serves SSR / legacy callers)
export async function GET() {
  try {
    const convex = getConvexClient()
    const announcements = await convex.query(api.announcements.getActive, {})
    return NextResponse.json(announcements)
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
      title:     body.title,
      body:      body.body ?? body.content ?? '',
      type:      body.type  ?? 'INFO',
      active:    body.active ?? true,
      dateStart: body.dateStart ? new Date(body.dateStart).getTime() : undefined,
      dateEnd:   body.dateEnd   ? new Date(body.dateEnd).getTime()   : undefined,
      expiresAt: body.expiresAt ? new Date(body.expiresAt).getTime() : undefined,
      createdBy: admin.name,
    })
    return NextResponse.json({ _id: id }, { status: 201 })
  } catch (err) {
    console.error('[announcements/POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
