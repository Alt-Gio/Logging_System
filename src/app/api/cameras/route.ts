export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { CameraSchema } from '@/lib/validation'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

export async function GET(req: NextRequest) {
  try {
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const convex  = getConvexClient()
  const cameras = await convex.query(api.cameras.getAll, {})
  return NextResponse.json(cameras)
  } catch (err) {
    console.error('[API]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }

}

export async function POST(req: NextRequest) {
  try {
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = CameraSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const convex = getConvexClient()
  const id     = await convex.mutation(api.cameras.create, { ...parsed.data })
  return NextResponse.json({ _id: id }, { status: 201 })
  } catch (err) {
    console.error('[API]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }

}
