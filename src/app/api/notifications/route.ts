export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-fallback-secret-change-me-00000')
}

async function getRecipientId(req: NextRequest): Promise<string | null> {
  const internToken = req.cookies.get('intern-session')?.value
  if (internToken) {
    try {
      const { payload } = await jwtVerify(internToken, getSecret())
      if (payload.role === 'INTERN') return payload.id as string
    } catch { /* fall */ }
  }
  const supToken = req.cookies.get('supervisor-session')?.value
  if (supToken) {
    try {
      const { payload } = await jwtVerify(supToken, getSecret())
      if (payload.role === 'SUPERVISOR') return payload.id as string
    } catch { /* fall */ }
  }
  return null
}

export async function GET(req: NextRequest) {
  const recipientId = await getRecipientId(req)
  if (!recipientId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const unreadOnly = req.nextUrl.searchParams.get('unreadOnly') === 'true'
    const convex = getConvexClient()
    const list = await convex.query(api.notifications.getForRecipient, {
      recipientId,
      limit:      30,
      unreadOnly: unreadOnly || undefined,
    })
    return NextResponse.json(list)
  } catch (e) {
    console.error('[notifications GET]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const recipientId = await getRecipientId(req)
  if (!recipientId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id, markAll } = await req.json()
    const convex = getConvexClient()
    if (markAll) {
      const result = await convex.mutation(api.notifications.markAllRead, { recipientId })
      return NextResponse.json(result)
    }
    if (id) {
      await convex.mutation(api.notifications.markRead, { id: id as Id<'notifications'> })
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'id or markAll required' }, { status: 400 })
  } catch (e) {
    console.error('[notifications PATCH]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
