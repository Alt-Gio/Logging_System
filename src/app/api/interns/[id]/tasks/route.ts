import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const convex = getConvexClient()
    const tasks  = await convex.query(api.internTasks.getTasksForIntern, {
      internId: params.id as Id<'interns'>,
    })
    return NextResponse.json(tasks)
  } catch (e) {
    console.error('[tasks/GET]', e)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { title, description, priority, dueDate, createdBy } = body
    if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 })

    const convex = getConvexClient()
    const id = await convex.mutation(api.internTasks.createTask, {
      internId:    params.id as Id<'interns'>,
      title,
      description: description || undefined,
      priority:    priority   || 'MEDIUM',
      dueDate:     dueDate    ? new Date(dueDate).getTime() : undefined,
      createdBy:   createdBy  as Id<'admins'> | undefined,
      taskId:      `task_${Date.now()}`,
    })
    return NextResponse.json({ _id: id }, { status: 201 })
  } catch (e) {
    console.error('[tasks/POST]', e)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, _ctx: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { taskId, status } = body
    if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

    const convex = getConvexClient()
    await convex.mutation(api.internTasks.updateTaskStatus, {
      taskId: taskId as Id<'internTasks'>,
      status: status as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[tasks/PATCH]', e)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, _ctx: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url)
    const taskId = searchParams.get('taskId')
    if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

    const convex = getConvexClient()
    await convex.mutation(api.internTasks.deleteTask, { taskId: taskId as Id<'internTasks'> })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[tasks/DELETE]', e)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
