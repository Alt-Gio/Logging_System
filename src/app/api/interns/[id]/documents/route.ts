import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const docs = await (prisma as any).internDocument.findMany({
      where: { internId: params.id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(docs)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { name, type, url, uploadedBy } = body
    if (!name || !url) return NextResponse.json({ error: 'name and url required' }, { status: 400 })

    const doc = await (prisma as any).internDocument.create({
      data: {
        internId: params.id,
        name,
        type: type || 'Document',
        url,
        uploadedBy: uploadedBy || null,
      },
    })
    return NextResponse.json(doc, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, _ctx: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url)
    const docId = searchParams.get('docId')
    if (!docId) return NextResponse.json({ error: 'docId required' }, { status: 400 })
    await (prisma as any).internDocument.delete({ where: { id: docId } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}
