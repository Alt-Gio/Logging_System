export const dynamic = 'force-dynamic'
// POST /api/sheets/interns — append intern registrations and attendance to Google Sheet
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { in: ['googleSheetId', 'googleServiceKey'] } },
    })
    const cfg: Record<string, string> = {}
    for (const r of rows) cfg[r.key] = r.value

    if (!cfg.googleSheetId || !cfg.googleServiceKey) {
      return NextResponse.json({ skipped: true, reason: 'Google Sheets not configured' })
    }

    let sa: { client_email: string; private_key: string }
    try { sa = JSON.parse(cfg.googleServiceKey) }
    catch { return NextResponse.json({ error: 'Invalid service account key' }, { status: 400 }) }

    const body = await req.json()
    const { type, data } = body // type: 'intern' | 'attendance'

    const jwt   = await makeGoogleJWT(sa.client_email, sa.private_key)
    const token = await getGoogleAccessToken(jwt)
    const sid   = cfg.googleSheetId

    if (type === 'intern') {
      await ensureSheet(sid, token, 'Interns')
      // Ensure header row exists
      await ensureHeader(sid, token, 'Interns', [
        'Full Name', 'School', 'Course', 'Department', 'Project Coordinator',
        'Email', 'Phone', 'Start Date', 'End Date', 'Required Hours', 'Registered At',
      ])
      await appendRow(sid, token, 'Interns', [
        data.fullName, data.school, data.course,
        data.department || '', data.supervisor || '',
        data.email || '', data.phone || '',
        data.startDate, data.endDate,
        data.requiredHours || 486,
        new Date().toLocaleString('en-PH'),
      ])
    } else if (type === 'attendance') {
      await ensureSheet(sid, token, 'Intern Attendance')
      await ensureHeader(sid, token, 'Intern Attendance', [
        'Intern Name', 'School', 'Date', 'Time In', 'Time Out', 'Hours Logged', 'Logged At',
      ])
      await appendRow(sid, token, 'Intern Attendance', [
        data.internName, data.school, data.date,
        data.timeIn ? new Date(data.timeIn).toLocaleTimeString('en-PH', { hour12: true }) : '',
        data.timeOut ? new Date(data.timeOut).toLocaleTimeString('en-PH', { hour12: true }) : '',
        data.hours || '',
        new Date().toLocaleString('en-PH'),
      ])
    } else {
      return NextResponse.json({ error: 'Unknown type. Use "intern" or "attendance".' }, { status: 400 })
    }

    return NextResponse.json({ success: true, type })
  } catch (e) {
    console.error('[sheets/interns]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function ensureSheet(sid: string, token: string, title: string) {
  // Get current sheets
  const meta = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sid}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } })
  const m = await meta.json()
  const exists = (m.sheets || []).some((s: any) => s.properties?.title === title)
  if (exists) return

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sid}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
  })
}

async function ensureHeader(sid: string, token: string, sheet: string, headers: string[]) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${encodeURIComponent(sheet)}!A1:Z1`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const d = await r.json()
  const existing = d.values?.[0]
  if (existing && existing.length > 0) return // header already there

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${encodeURIComponent(sheet)}!A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [headers] }),
    },
  )
}

async function appendRow(sid: string, token: string, sheet: string, row: (string | number)[]) {
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${encodeURIComponent(sheet)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] }),
    },
  )
}

async function makeGoogleJWT(email: string, pem: string) {
  const now = Math.floor(Date.now() / 1000)
  const b64url = (s: string) => btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const hdr = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const pay = b64url(JSON.stringify({
    iss: email, scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now,
  }))
  const body = `${hdr}.${pay}`
  const pemBody = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n|\r/g, '')
  const keyDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', keyDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(body))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${body}.${sigB64}`
}

async function getGoogleAccessToken(jwt: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const d = await res.json()
  if (!d.access_token) throw new Error(`OAuth error: ${d.error_description || d.error}`)
  return d.access_token
}
