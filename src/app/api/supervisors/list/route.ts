export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAuth(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const convex = getConvexClient()
    const supervisors = await convex.query(api.supervisors.getAll, {})
    return NextResponse.json(supervisors.map(s => ({
      _id:          s._id,
      email:        s.email,
      name:         s.name,
      department:   s.department,
      phone:        s.phone,
      position:     s.position,
      schoolId:     s.schoolId,
      emailVerified:s.emailVerified,
      lastLogin:    s.lastLogin,
    })))
  } catch (e) {
    console.error('[supervisors/list]', e)
    return NextResponse.json({ error: 'Failed to list supervisors' }, { status: 500 })
  }
}
