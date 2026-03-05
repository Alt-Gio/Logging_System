import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const pc = await prisma.pC.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.ipAddress !== undefined && { ipAddress: body.ipAddress }),
        ...(body.location !== undefined && { location: body.location }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.ssid !== undefined && { ssid: body.ssid || null }),
        ...(body.specs !== undefined && { specs: body.specs || null }),
        ...(body.icon !== undefined && { icon: body.icon || '🖥️' }),
        ...(body.gridCol !== undefined && { gridCol: body.gridCol }),
        ...(body.gridRow !== undefined && { gridRow: body.gridRow }),
      },
    })
    return NextResponse.json(pc)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.pC.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
