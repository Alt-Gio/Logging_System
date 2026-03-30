import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const convex = getConvexClient()
    const docs   = await convex.query(api.internDocuments.getForIntern, {
      internId: params.id as Id<'interns'>,
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

    const convex = getConvexClient()
    const id     = await convex.mutation(api.internDocuments.create, {
      internId:   params.id as Id<'interns'>,
      name,
      type:       type || 'Document',
      url,
      uploadedBy: uploadedBy || undefined,
    })
    return NextResponse.json({ _id: id }, { status: 201 })
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
    const convex = getConvexClient()
    await convex.mutation(api.internDocuments.remove, { id: docId as Id<'internDocuments'> })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { docId, tags } = await req.json()
    if (!docId || !Array.isArray(tags)) return NextResponse.json({ error: 'docId and tags[] required' }, { status: 400 })
    const convex = getConvexClient()
    await convex.mutation(api.internDocuments.updateTags, {
      id:   docId as Id<'internDocuments'>,
      tags: tags as string[],
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to update tags' }, { status: 500 })
  }
}
