export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { status } = await req.json()
    if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 })
    const convex = getConvexClient()
    await convex.mutation(api.internTasks.updateTaskStatus, {
      taskId: params.id as Id<'internTasks'>,
      status: status as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[intern-tasks/[id] PATCH]', e)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}
