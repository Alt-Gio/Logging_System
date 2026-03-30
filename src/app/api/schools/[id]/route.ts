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
    await convex.mutation(api.schools.update, {
      id:                   params.id as Id<'schools'>,
      name:                 body.name,
      type:                 body.type,
      address:              body.address,
      email:                body.email,
      practicumCoordinator: body.practicumCoordinator,
      coordinatorEmail:     body.coordinatorEmail,
      coordinatorPhone:     body.coordinatorPhone,
      active:               body.active,
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[schools/PATCH]', e)
    return NextResponse.json({ error: 'Failed to update school' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const convex = getConvexClient()
    await convex.mutation(api.schools.remove, { id: params.id as Id<'schools'> })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[schools/DELETE]', e)
    return NextResponse.json({ error: 'Failed to delete school' }, { status: 500 })
  }
}
