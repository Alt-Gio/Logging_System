import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tasks = await (prisma as any).internTask.findMany({
      where: { internId: params.id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(tasks)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { title, description, priority, dueDate } = body
    if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 })

    const task = await (prisma as any).internTask.create({
      data: {
        internId: params.id,
        title,
        description: description || null,
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    })
    return NextResponse.json(task, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, _ctx: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { taskId, status, title, description, priority, dueDate } = body
    if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

    const task = await (prisma as any).internTask.update({
      where: { id: taskId },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(priority && { priority }),
        ...(status && {
          status,
          completedAt: status === 'COMPLETED' ? new Date() : null,
        }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      },
    })
    return NextResponse.json(task)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, _ctx: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url)
    const taskId = searchParams.get('taskId')
    if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })
    await (prisma as any).internTask.delete({ where: { id: taskId } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
