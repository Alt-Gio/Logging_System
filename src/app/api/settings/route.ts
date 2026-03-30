export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

const DEFAULTS = {
  wifiSsid: 'DICT-DTC-Free', wifiPassword: '',
  wifiNote: 'Free public WiFi for DTC clients',
  accessCode: '1234', officeOpen: '08:00', officeClose: '17:00',
  bgImageUrl: '', interactiveBannerUrl: '',
  googleSheetId: '', googleServiceKey: '',
  hero_title:        'Free Digital\nServices for\nEvery Bicolano',
  hero_subtitle:     'The DICT Digital Technology Center provides free computer access, e-government assistance, high-speed internet, and digital literacy programs — open to all citizens of Bicol.',
  hero_badge:        'DICT REGION V · BICOL',
  hero_media_url:    '',
  hero_media_type:   'none',
  office_hours:      'Monday – Friday  8:00 AM – 5:00 PM',
  office_location:   '2/F Post Telecom Bldg., Lapu Lapu St., Legazpi City',
  office_lat:        '13.1391',
  office_lng:        '123.7438',
  checkin_radius_m:  '300',
  mapbox_token:      '',
}

export async function GET() {
  try {
    const convex = getConvexClient()
    const rows   = await convex.query(api.settings.getAll, {})
    const s = { ...DEFAULTS } as Record<string, string>
    for (const row of rows) s[row.key] = row.value
    return NextResponse.json(s)
  } catch {
    return NextResponse.json(DEFAULTS)
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw    = await req.json()
  const convex = getConvexClient()
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue
    await convex.mutation(api.settings.set, { key, value: String(value) })
  }
  return NextResponse.json({ success: true })
}

export async function PUT(req: NextRequest) {
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw    = await req.json()
  const convex = getConvexClient()
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue
    await convex.mutation(api.settings.set, { key, value: String(value) })
  }
  return NextResponse.json({ success: true })
}
