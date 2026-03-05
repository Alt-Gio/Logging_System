import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const UpdateLogSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  agency: z.string().min(2).max(100).optional(),
  purpose: z.string().optional(),
  equipmentUsed: z.array(z.string()).optional(),
  timeIn: z.string().optional().nullable(),
  timeOut: z.string().optional().nullable(),
  plannedDurationHours: z.number().optional(),
  archived: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const data = UpdateLogSchema.parse(body)
    const updateData: Record<string, unknown> = {}
    if (data.fullName !== undefined) updateData.fullName = data.fullName
    if (data.agency !== undefined) updateData.agency = data.agency
    if (data.purpose !== undefined) updateData.purpose = data.purpose
    if (data.equipmentUsed !== undefined) updateData.equipmentUsed = data.equipmentUsed
    if (data.timeIn !== undefined) updateData.timeIn = data.timeIn ? new Date(data.timeIn) : undefined
    if (data.timeOut !== undefined) updateData.timeOut = data.timeOut ? new Date(data.timeOut) : null
    if (data.plannedDurationHours !== undefined) updateData.plannedDurationHours = data.plannedDurationHours
    if (data.archived !== undefined) updateData.archived = data.archived

    const updated = await prisma.logEntry.update({
      where: { id: params.id },
      data: updateData,
      include: { pc: { select: { name: true, ipAddress: true } } },
    })

    // If checking out, try to free the PC
    if (data.timeOut && updated.pcId) {
      const hasActiveUser = await prisma.logEntry.findFirst({
        where: { pcId: updated.pcId, timeOut: null, id: { not: params.id } }
      })
      if (!hasActiveUser) {
        await prisma.pC.update({ where: { id: updated.pcId }, data: { status: 'ONLINE' } }).catch(() => {})
      }
    }

    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Archive instead of delete
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const updated = await prisma.logEntry.update({
      where: { id: params.id },
      data: { archived: true },
    })
    return NextResponse.json(updated)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
