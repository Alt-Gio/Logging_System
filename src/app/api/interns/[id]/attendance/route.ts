import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const records = await (prisma as any).internAttendance.findMany({
      where: { internId: params.id },
      orderBy: { date: 'desc' },
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

    // Compute hours if both timeIn and timeOut provided
    let hours: number | null = null
    if (timeIn && timeOut) {
      const diff = (new Date(timeOut).getTime() - new Date(timeIn).getTime()) / (1000 * 60 * 60)
      hours = Math.round(diff * 100) / 100
    }

    const record = await (prisma as any).internAttendance.create({
      data: {
        internId: params.id,
        date: new Date(date),
        timeIn: timeIn ? new Date(timeIn) : null,
        timeOut: timeOut ? new Date(timeOut) : null,
        hours,
        status: status || 'PRESENT',
        notes: notes || null,
      },
    })
    return NextResponse.json(record, { status: 201 })
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

    const record = await (prisma as any).internAttendance.update({
      where: { id: recordId },
      data: {
        ...(timeIn && { timeIn: new Date(timeIn) }),
        ...(timeOut && { timeOut: new Date(timeOut) }),
        ...(hours !== null && { hours }),
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
      },
    })
    return NextResponse.json(record)
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
    await (prisma as any).internAttendance.delete({ where: { id: recordId } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to delete attendance' }, { status: 500 })
  }
}
