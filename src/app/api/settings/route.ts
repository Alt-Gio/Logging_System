<<<<<<< HEAD
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { SettingsSchema } from '@/lib/validation'

const DEFAULTS = {
  wifiSsid: 'DICT-DTC-Free', wifiPassword: '',
  wifiNote: 'Free public WiFi for DTC clients',
  accessCode: '1234', officeOpen: '08:00', officeClose: '17:00',
}

export async function GET() {
  try {
    const rows = await prisma.setting.findMany()
    const s = { ...DEFAULTS } as Record<string, string>
    for (const row of rows) s[row.key] = row.value
    return NextResponse.json(s)
  } catch {
    return NextResponse.json(DEFAULTS)
=======
// src/app/api/settings/route.ts
import { NextRequest, NextResponse } from 'next/server'

// We store settings in a simple in-memory + env approach.
// For production, these are stored in the DB via a Settings table.
// For now we use a module-level object (persists per process, survives restarts via DB later).

import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Try to fetch from DB settings table (key-value)
    const rows = await prisma.setting.findMany()
    const settings: Record<string, string> = {}
    for (const row of rows) settings[row.key] = row.value
    return NextResponse.json(settings)
  } catch {
    // Table might not exist yet
    return NextResponse.json({
      wifiSsid: 'DICT-DTC-Free',
      wifiPassword: '',
      wifiNote: 'Free public WiFi for DTC clients',
      accessCode: '1234',
      officeOpen: '08:00',
      officeClose: '17:00',
    })
>>>>>>> 41c2fab67e2056a336b2c8168d30a3e8d0f6ab74
  }
}

export async function POST(req: NextRequest) {
<<<<<<< HEAD
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await req.json()
  const parsed = SettingsSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const changed: string[] = []
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue
    await prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    })
    changed.push(key)
  }

  await audit('CHANGE_SETTING', { req, adminId: admin.id, detail: { changed } })
  return NextResponse.json({ success: true })
=======
  try {
    const body = await req.json()
    for (const [key, value] of Object.entries(body)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
>>>>>>> 41c2fab67e2056a336b2c8168d30a3e8d0f6ab74
}
