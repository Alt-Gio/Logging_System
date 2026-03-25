import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const convex  = getConvexClient()
    const raw = await convex.query(api.interns.getAll, status ? { status } : {})
    const interns = raw.map((i: Record<string, unknown>) => ({
      id:           i._id,
      _id:          i._id,
      fullName:     i.fullName,
      school:       i.school,
      course:       i.course,
      department:   i.department   ?? null,
      supervisor:   i.supervisor   ?? null,
      status:       i.status,
      totalHours:   i.totalHoursLogged ?? 0,
      totalHoursLogged: i.totalHoursLogged ?? 0,
      requiredHours: i.requiredHours ?? 486,
      photoUrl:     i.photoUrl     ?? null,
      email:        i.email        ?? null,
      phone:        i.phone        ?? null,
      startDate:    i.startDate    ? new Date(i.startDate as number).toISOString() : null,
      endDate:      i.endDate      ? new Date(i.endDate   as number).toISOString() : null,
      notes:        i.notes        ?? null,
      attendance:   [],
      tasks:        [],
    }))
    return NextResponse.json(interns)
  } catch (e) {
    console.error('[interns/GET]', e)
    return NextResponse.json({ error: 'Failed to fetch interns', details: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fullName, school, course, department, supervisor, startDate, endDate, requiredHours, email, phone, photoUrl, notes } = body

    if (!fullName || !school || !course || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const convex = getConvexClient()
    const id = await convex.mutation(api.interns.create, {
      fullName,
      school,
      course,
      department:    department    || undefined,
      supervisor:    supervisor    || undefined,
      startDate:     new Date(startDate).getTime(),
      endDate:       new Date(endDate).getTime(),
      requiredHours: requiredHours ? parseInt(requiredHours) : 486,
      status:        'ACTIVE',
      email:         email    || undefined,
      phone:         phone    || undefined,
      photoUrl:      photoUrl || undefined,
      notes:         notes    || undefined,
    })
    return NextResponse.json({ _id: id }, { status: 201 })
  } catch (e) {
    console.error('[interns/POST]', e)
    return NextResponse.json({ error: 'Failed to create intern' }, { status: 500 })
  }
}
