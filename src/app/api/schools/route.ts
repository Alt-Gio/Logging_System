export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function GET() {
  try {
    const convex = getConvexClient()
    const schools = await convex.query(api.schools.getAll, {})
    return NextResponse.json(schools)
  } catch (e) {
    console.error('[schools/GET]', e)
    return NextResponse.json({ error: 'Failed to load schools' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 })

    const convex = getConvexClient()
    const id = await convex.mutation(api.schools.create, {
      name:                 body.name,
      type:                 body.type,
      address:              body.address,
      email:                body.email,
      practicumCoordinator: body.practicumCoordinator,
      coordinatorEmail:     body.coordinatorEmail,
      coordinatorPhone:     body.coordinatorPhone,
      active:               body.active ?? true,
    })
    return NextResponse.json({ _id: id }, { status: 201 })
  } catch (e) {
    console.error('[schools/POST]', e)
    return NextResponse.json({ error: 'Failed to create school' }, { status: 500 })
  }
}
