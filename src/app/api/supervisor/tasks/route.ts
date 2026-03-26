import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import crypto from 'crypto'

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-fallback-secret-change-me-00000')
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('supervisor-session')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.role !== 'SUPERVISOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const supervisorId = payload.id as string
    const { title, description, priority, difficulty, internId, dueDate, xpReward } = await req.json()

    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

    const convex = getConvexClient()
    const taskId = await convex.mutation(api.internTasks.createTask, {
      internId:            internId ? internId as Id<'interns'> : undefined,
      title,
      description:         description || undefined,
      priority:            priority ?? 'MEDIUM',
      difficulty:          difficulty ?? 'easy',
      xpReward:            xpReward ?? 10,
      type:                'todo',
      dueDate:             dueDate ? Number(dueDate) : undefined,
      createdBySupervisor: supervisorId as Id<'supervisors'>,
      taskId:              crypto.randomUUID(),
    })

    // Notify assigned intern (if specific)
    if (internId) {
      const account = await convex.query(api.internAccounts.getByInternId, {
        internId: internId as Id<'interns'>,
      })
      if (account) {
        await convex.mutation(api.notifications.create, {
          recipientId:   account._id,
          recipientType: 'intern',
          title:         `📋 New task: ${title}`,
          body:          `Your supervisor assigned you a new ${difficulty ?? 'easy'} task. +${xpReward ?? 10} XP on completion!`,
          type:          'task',
          link:          '/intern/dashboard',
        })
      }
    }

    return NextResponse.json({ id: taskId }, { status: 201 })
  } catch (e) {
    console.error('[supervisor/tasks POST]', e)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
