import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const interns = await (prisma as any).intern.findMany({
      where: status ? { status } : undefined,
      include: {
        attendance: { orderBy: { date: 'desc' }, take: 30 },
        tasks: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Compute total logged hours for each intern
    const enriched = interns.map((intern: any) => {
      const totalHours = intern.attendance.reduce((sum: number, a: any) => sum + (a.hours ?? 0), 0)
      return { ...intern, totalHours }
    })

    return NextResponse.json(enriched)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch interns' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fullName, school, course, department, supervisor, startDate, endDate, requiredHours, email, phone, photoUrl, notes } = body

    if (!fullName || !school || !course || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const intern = await (prisma as any).intern.create({
      data: {
        fullName,
        school,
        course,
        department: department || null,
        supervisor: supervisor || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        requiredHours: requiredHours ? parseInt(requiredHours) : 486,
        email: email || null,
        phone: phone || null,
        photoUrl: photoUrl || null,
        notes: notes || null,
      },
    })

    return NextResponse.json(intern, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to create intern' }, { status: 500 })
  }
}
