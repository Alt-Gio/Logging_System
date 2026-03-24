import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const convex = getConvexClient()
    const intern = await convex.query(api.interns.getById, { id: params.id as Id<'interns'> })
    if (!intern) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(intern)
  } catch (e) {
    console.error('[interns/[id]/GET]', e)
    return NextResponse.json({ error: 'Failed to fetch intern' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const convex = getConvexClient()
    await convex.mutation(api.interns.update, {
      id:            params.id as Id<'interns'>,
      fullName:      body.fullName,
      school:        body.school,
      course:        body.course,
      department:    body.department   || undefined,
      supervisor:    body.supervisor   || undefined,
      startDate:     body.startDate    ? new Date(body.startDate).getTime()  : undefined,
      endDate:       body.endDate      ? new Date(body.endDate).getTime()    : undefined,
      requiredHours: body.requiredHours,
      status:        body.status,
      email:         body.email        || undefined,
      phone:         body.phone        || undefined,
      photoUrl:      body.photoUrl     || undefined,
      notes:         body.notes        || undefined,
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[interns/[id]/PATCH]', e)
    return NextResponse.json({ error: 'Failed to update intern' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const convex = getConvexClient()
    await convex.mutation(api.interns.remove, { id: params.id as Id<'interns'> })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[interns/[id]/DELETE]', e)
    return NextResponse.json({ error: 'Failed to delete intern' }, { status: 500 })
  }
}
