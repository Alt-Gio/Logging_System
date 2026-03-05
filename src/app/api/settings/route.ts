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
  }
}

export async function POST(req: NextRequest) {
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
}
