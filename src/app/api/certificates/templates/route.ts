import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const templates = await (prisma as any).certificateTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { certificates: true }
        }
      }
    })
    return NextResponse.json(templates)
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, description, backgroundUrl, width, height, fields } = body

    if (!name || !fields) {
      return NextResponse.json({ error: 'Name and fields are required' }, { status: 400 })
    }

    const template = await (prisma as any).certificateTemplate.create({
      data: {
        name,
        description,
        backgroundUrl,
        width: width || 1056,
        height: height || 816,
        fields
      }
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
