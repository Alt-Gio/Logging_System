import { NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function GET() {
  try {
    const convex   = getConvexClient()
    const all      = await convex.query(api.interns.getAll)
    const total    = all.length
    const active   = all.filter(i => i.status === 'ACTIVE').length
    const completed = all.filter(i => i.status === 'COMPLETED').length
    const inactive = all.filter(i => i.status === 'INACTIVE').length
    const sample   = all.slice(0, 10).map(i => ({
      id: i._id, fullName: i.fullName, school: i.school,
      status: i.status, createdAt: i._creationTime,
    }))

    return NextResponse.json({
      counts: { total, active, completed, inactive },
      sample,
      message: total === 0
        ? 'No interns found. Run POST /api/interns/seed to create sample data.'
        : `Found ${total} intern(s) in database`,
    })
  } catch (e) {
    console.error('[DEBUG] Error:', e)
    return NextResponse.json({
      error: 'Database error',
      details: String(e),
      message: 'Check if CONVEX_URL is configured correctly',
    }, { status: 500 })
  }
}
