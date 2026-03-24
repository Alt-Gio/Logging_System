import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function POST(req: NextRequest) {
  try {
    const convex        = getConvexClient()
    const existingAll   = await convex.query(api.interns.getAll)
    const existingCount = existingAll.length
    if (existingCount > 0) {
      return NextResponse.json({ message: 'Interns already exist in database', count: existingCount }, { status: 200 })
    }

    const today = new Date()
    const startDate = new Date(today)
    startDate.setMonth(today.getMonth() - 2)
    const endDate = new Date(today)
    endDate.setMonth(today.getMonth() + 2)

    const sampleInterns = [
      {
        fullName: 'Maria Santos',
        school: 'Bicol University',
        course: 'BS Information Technology',
        department: 'IT Department',
        supervisor: 'Dr. Juan dela Cruz',
        email: 'maria.santos@bicol.edu.ph',
        phone: '09171234567',
        requiredHours: 486,
        status: 'ACTIVE',
      },
      {
        fullName: 'John Paul Reyes',
        school: 'Aquinas University',
        course: 'BS Computer Science',
        department: 'IT Department',
        supervisor: 'Prof. Ana Garcia',
        email: 'jp.reyes@aquinas.edu.ph',
        phone: '09187654321',
        requiredHours: 486,
        status: 'ACTIVE',
      },
      {
        fullName: 'Angela Cruz',
        school: 'Divine Word College of Legazpi',
        course: 'BS Information Systems',
        department: 'IT Department',
        supervisor: 'Dr. Roberto Tan',
        email: 'angela.cruz@dwc.edu.ph',
        phone: '09191234567',
        requiredHours: 486,
        status: 'ACTIVE',
      },
      {
        fullName: 'Carlos Mendoza',
        school: 'Bicol University',
        course: 'BS Computer Engineering',
        department: 'Engineering',
        supervisor: 'Engr. Lisa Ramos',
        email: 'carlos.mendoza@bicol.edu.ph',
        phone: '09201234567',
        requiredHours: 486,
        status: 'ACTIVE',
      },
      {
        fullName: 'Patricia Lim',
        school: 'Aquinas University',
        course: 'BS Information Technology',
        department: 'IT Department',
        supervisor: 'Prof. Ana Garcia',
        email: 'patricia.lim@aquinas.edu.ph',
        phone: '09211234567',
        requiredHours: 486,
        status: 'ACTIVE',
      },
    ]

    const createdInterns = []

    for (const internData of sampleInterns) {
      const internId = await convex.mutation(api.interns.create, {
        ...internData,
        startDate: startDate.getTime(),
        endDate:   endDate.getTime(),
      })

      let attendanceCount = 0
      for (let i = 14; i >= 1; i--) {
        const date = new Date(today)
        date.setDate(today.getDate() - i)
        if (date.getDay() === 0 || date.getDay() === 6) continue
        if (Math.random() > 0.1) {
          const timeIn = new Date(date)
          timeIn.setHours(8, Math.floor(Math.random() * 30), 0, 0)
          const timeOut = new Date(date)
          timeOut.setHours(17, Math.floor(Math.random() * 30), 0, 0)
          const hours = Math.round(((timeOut.getTime() - timeIn.getTime()) / 3600000) * 100) / 100
          await convex.mutation(api.internAttendance.create, {
            internId,
            date:    date.getTime(),
            timeIn:  timeIn.getTime(),
            timeOut: timeOut.getTime(),
            hours,
            status:  'PRESENT',
          })
          attendanceCount++
        }
      }

      createdInterns.push({ name: internData.fullName, attendanceCount })
    }

    return NextResponse.json({
      success: true,
      message: 'Sample interns created successfully',
      interns: createdInterns,
    }, { status: 201 })

  } catch (e) {
    console.error('[API] Error seeding interns:', e)
    return NextResponse.json({ 
      error: 'Failed to seed interns', 
      details: String(e) 
    }, { status: 500 })
  }
}
