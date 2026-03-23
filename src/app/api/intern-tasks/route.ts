import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const internId = searchParams.get('internId')

    const tasks = await (prisma as any).internTask.findMany({
      where: internId
        ? { OR: [{ internId }, { internId: null }] }
        : { internId: null },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json(tasks)
  } catch (e) {
    console.error('[intern-tasks GET]', e)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { taskId, isCompleted } = await req.json()
    if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

    const task = await (prisma as any).internTask.update({
      where: { id: taskId },
      data: {
        status: isCompleted ? 'COMPLETED' : 'PENDING',
        completedAt: isCompleted ? new Date() : null,
      },
    })
    return NextResponse.json(task)
  } catch (e) {
    console.error('[intern-tasks PATCH]', e)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}
