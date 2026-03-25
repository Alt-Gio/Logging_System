export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function GET(req: NextRequest) {
  try {
    const admin  = await requireAuth(req)
    const convex = getConvexClient()
    const pcs    = await convex.query(api.pcs.getActive, {})

    return NextResponse.json(pcs.map(pc => ({
      ...pc,
      // Strip sensitive fields from unauthenticated callers
      ...(!admin ? { ipAddress: undefined, macAddress: undefined, ssid: undefined } : {}),
    })))
  } catch (err) {
    console.error('[pcs/GET]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body   = await req.json()
    const convex = getConvexClient()

    // Auto-assign next available grid position
    const existing = await convex.query(api.pcs.getAll, {})
    const sorted   = [...existing].sort((a, b) =>
      (a.gridRow ?? 1) !== (b.gridRow ?? 1)
        ? (a.gridRow ?? 1) - (b.gridRow ?? 1)
        : (a.gridCol ?? 1) - (b.gridCol ?? 1),
    )
    let gridCol = 1, gridRow = 1
    if (sorted.length > 0) {
      const last = sorted[sorted.length - 1]
      gridCol = ((last.gridCol ?? 1) % 5) + 1
      gridRow = gridCol === 1 ? (last.gridRow ?? 1) + 1 : (last.gridRow ?? 1)
    }

    const id = await convex.mutation(api.pcs.create, {
      name:      body.name,
      ipAddress: body.ipAddress,
      location:  body.location ?? undefined,
      icon:      body.icon    || '🖥️',
      isActive:  true,
      status:    'OFFLINE',
      gridCol, gridRow,
    })
    return NextResponse.json({ _id: id }, { status: 201 })
  } catch (err) {
    console.error('[pcs/POST]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
