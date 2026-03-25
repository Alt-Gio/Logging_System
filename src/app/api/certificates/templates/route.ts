import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function GET() {
  try {
    const convex     = getConvexClient()
    const templates  = await convex.query(api.certificates.getAllTemplates, {})
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

    const convex = getConvexClient()
    const id = await convex.mutation(api.certificates.createTemplate, {
      name,
      description,
      backgroundUrl,
      width:  width  || 1056,
      height: height || 816,
      fields,
    })
    return NextResponse.json({ _id: id }, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
