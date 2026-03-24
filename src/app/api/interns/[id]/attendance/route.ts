import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const convex   = getConvexClient()
    const records  = await convex.query(api.internAttendance.getForIntern, {
      internId: params.id as Id<'interns'>,
    })
    return NextResponse.json(records)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { date, timeIn, timeOut, status, notes } = body

    // Reject future dates
    const recordDate = new Date(date)
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    if (recordDate > today) {
      return NextResponse.json({ error: 'Cannot log attendance for a future date' }, { status: 400 })
    }

    // Compute hours if both timeIn and timeOut provided
    let hours: number | null = null
    if (timeIn && timeOut) {
      const diff = (new Date(timeOut).getTime() - new Date(timeIn).getTime()) / (1000 * 60 * 60)
      hours = Math.round(diff * 100) / 100
    }

    const convex = getConvexClient()
    const id = await convex.mutation(api.internAttendance.create, {
      internId: params.id as Id<'interns'>,
      date:     new Date(date).getTime(),
      timeIn:   timeIn  ? new Date(timeIn).getTime()  : undefined,
      timeOut:  timeOut ? new Date(timeOut).getTime() : undefined,
      hours:    hours   ?? undefined,
      status:   (status || 'PRESENT') as 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'HOLIDAY',
      notes:    notes   || undefined,
    })
    return NextResponse.json({ _id: id }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to add attendance record' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { recordId, timeIn, timeOut, status, notes } = body

    let hours: number | null = null
    if (timeIn && timeOut) {
      const diff = (new Date(timeOut).getTime() - new Date(timeIn).getTime()) / (1000 * 60 * 60)
      hours = Math.round(diff * 100) / 100
    }

    const convex = getConvexClient()
    await convex.mutation(api.internAttendance.update, {
      id:      recordId as Id<'internAttendance'>,
      timeIn:  timeIn  ? new Date(timeIn).getTime()  : undefined,
      timeOut: timeOut ? new Date(timeOut).getTime() : undefined,
      hours:   hours   ?? undefined,
      status:  status  as 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'HOLIDAY' | undefined,
      notes:   notes   ?? undefined,
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to update attendance' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, _ctx: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url)
    const recordId = searchParams.get('recordId')
    if (!recordId) return NextResponse.json({ error: 'recordId required' }, { status: 400 })
    const convex = getConvexClient()
    await convex.mutation(api.internAttendance.remove, { id: recordId as Id<'internAttendance'> })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to delete attendance' }, { status: 500 })
  }
}
