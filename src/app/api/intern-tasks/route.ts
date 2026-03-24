import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const internId = searchParams.get('internId')
    const convex   = getConvexClient()

    if (internId) {
      const tasks = await convex.query(api.internTasks.getTasksForIntern, {
        internId: internId as Id<'interns'>,
      })
      return NextResponse.json(tasks)
    }
    const tasks = await convex.query(api.internTasks.getAllTasks)
    return NextResponse.json(tasks)
  } catch (e) {
    console.error('[intern-tasks GET]', e)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { taskId, status, isCompleted } = await req.json()
    if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

    const convex    = getConvexClient()
    const newStatus = status ?? (isCompleted ? 'COMPLETED' : 'PENDING')
    await convex.mutation(api.internTasks.updateTaskStatus, {
      taskId: taskId as Id<'internTasks'>,
      status: newStatus as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[intern-tasks PATCH]', e)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}
