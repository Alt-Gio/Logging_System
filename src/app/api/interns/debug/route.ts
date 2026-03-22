import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get total count
    const totalCount = await (prisma as any).intern.count()
    
    // Get count by status
    const activeCount = await (prisma as any).intern.count({ where: { status: 'ACTIVE' } })
    const completedCount = await (prisma as any).intern.count({ where: { status: 'COMPLETED' } })
    const inactiveCount = await (prisma as any).intern.count({ where: { status: 'INACTIVE' } })
    
    // Get all interns (limited to 10 for safety)
    const allInterns = await (prisma as any).intern.findMany({
      take: 10,
      select: {
        id: true,
        fullName: true,
        school: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      counts: {
        total: totalCount,
        active: activeCount,
        completed: completedCount,
        inactive: inactiveCount,
      },
      sample: allInterns,
      message: totalCount === 0 
        ? 'No interns found. Run POST /api/interns/seed to create sample data.'
        : `Found ${totalCount} intern(s) in database`
    })
  } catch (e) {
    console.error('[DEBUG] Error:', e)
    return NextResponse.json({ 
      error: 'Database error', 
      details: String(e),
      message: 'Check if DATABASE_URL is configured correctly'
    }, { status: 500 })
  }
}
