export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function GET() {
  try {
    const convex = getConvexClient()
    const slides = await convex.query(api.heroSlides.listActive, {})
    return NextResponse.json(slides)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const convex = getConvexClient()
    const id = await convex.mutation(api.heroSlides.create, body)
    return NextResponse.json({ id })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed to create slide' }, { status: 500 })
  }
}
