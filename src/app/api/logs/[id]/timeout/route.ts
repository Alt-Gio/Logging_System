export const dynamic = 'force-dynamic'
// src/app/api/logs/[id]/timeout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const convex = getConvexClient()
  const log    = await convex.query(api.logEntries.getById, { id: params.id as Id<'logEntries'> })
  if (!log)          return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (log.timeOut)   return NextResponse.json({ error: 'Already checked out' }, { status: 400 })
  if (log.archived)  return NextResponse.json({ error: 'Log is archived' }, { status: 400 })

  const now = Date.now()
  await convex.mutation(api.logEntries.timeOut, { id: params.id as Id<'logEntries'>, timeOut: now })

  if (log.pcId) {
    await convex.mutation(api.pcs.updateStatus, {
      id: log.pcId, status: 'ONLINE', lastSeen: now,
    })
  }

  return NextResponse.json({ success: true, timeOut: now })
}
