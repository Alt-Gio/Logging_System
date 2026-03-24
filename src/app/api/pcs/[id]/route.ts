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

    const body   = await req.json()
    const convex = getConvexClient()
    await convex.mutation(api.pcs.update, {
      id:        params.id as Id<'pcs'>,
      name:      body.name,
      ipAddress: body.ipAddress,
      macAddress:body.macAddress,
      location:  body.location,
      ssid:      body.ssid,
      specs:     body.specs,
      icon:      body.icon,
      gridCol:   body.gridCol,
      gridRow:   body.gridRow,
      isActive:  body.isActive,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[pcs/PATCH]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const convex = getConvexClient()
    await convex.mutation(api.pcs.update, {
      id:       params.id as Id<'pcs'>,
      isActive: false,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[pcs/DELETE]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
