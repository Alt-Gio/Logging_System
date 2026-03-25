import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { templateId, data, internId } = body

    if (!templateId || !data) {
      return NextResponse.json({ error: 'Template ID and data are required' }, { status: 400 })
    }

    const convex = getConvexClient()
    const id = await convex.mutation(api.certificates.issue, {
      templateId: templateId as Id<'certificateTemplates'>,
      internId:   internId  ? internId as Id<'interns'> : undefined,
      data,
    })
    return NextResponse.json({ _id: id }, { status: 201 })
  } catch (error) {
    console.error('Error generating certificate:', error)
    return NextResponse.json({ error: 'Failed to generate certificate' }, { status: 500 })
  }
}

// Bulk generation from CSV/Excel
export async function PUT(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const templateId = formData.get('templateId') as string

    if (!file || !templateId) {
      return NextResponse.json({ error: 'File and template ID are required' }, { status: 400 })
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse Excel/CSV
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[]

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data found in file' }, { status: 400 })
    }

    const convex  = getConvexClient()
    const template = await convex.query(api.certificates.getTemplateById, {
      id: templateId as Id<'certificateTemplates'>,
    })
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    const allInterns = await convex.query(api.interns.getAll, {})

    const certificates = []
    for (const row of rows) {
      let internId: Id<'interns'> | undefined
      const nameToMatch: string | undefined = row.fullName || row.name || row.Name
      if (nameToMatch) {
        const match = allInterns.find(i =>
          i.fullName.toLowerCase().includes(nameToMatch.toLowerCase())
        )
        if (match) internId = match._id
      }
      const id = await convex.mutation(api.certificates.issue, {
        templateId: templateId as Id<'certificateTemplates'>,
        internId,
        data: row,
      })
      certificates.push({ _id: id })
    }

    return NextResponse.json({
      success: true,
      count: certificates.length,
      certificates
    })
  } catch (error) {
    console.error('Error bulk generating certificates:', error)
    return NextResponse.json({ error: 'Failed to bulk generate certificates' }, { status: 500 })
  }
}
