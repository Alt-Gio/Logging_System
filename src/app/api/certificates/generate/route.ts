import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { templateId, data, internId } = body

    if (!templateId || !data) {
      return NextResponse.json({ error: 'Template ID and data are required' }, { status: 400 })
    }

    const certificate = await (prisma as any).certificate.create({
      data: {
        templateId,
        internId: internId || null,
        data,
        issuedAt: new Date()
      },
      include: {
        template: true,
        intern: true
      }
    })

    return NextResponse.json(certificate, { status: 201 })
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

    // Get template to validate fields
    const template = await (prisma as any).certificateTemplate.findUnique({
      where: { id: templateId }
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Generate certificates for each row
    const certificates = []
    for (const row of rows) {
      // Try to match intern by name if provided
      let internId = null
      if (row.fullName || row.name || row.Name) {
        const nameToMatch = row.fullName || row.name || row.Name
        const intern = await (prisma as any).intern.findFirst({
          where: {
            fullName: {
              contains: nameToMatch,
              mode: 'insensitive'
            }
          }
        })
        if (intern) internId = intern.id
      }

      const cert = await (prisma as any).certificate.create({
        data: {
          templateId,
          internId,
          data: row,
          issuedAt: new Date()
        }
      })
      certificates.push(cert)
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
