// POST /api/sheets/sync — push log entries to connected Google Sheet
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { format } from 'date-fns'

type LogRow = {
  id: string; fullName: string; agency: string; purpose: string
  equipmentUsed: string[]; serviceType: string; timeIn: Date; timeOut: Date | null
  plannedDurationHours: number; satisfactionRating: number | null
  staffNotes: string | null; pc: { name: string } | null
}

export async function POST(req: NextRequest) {
  const admin = await requireAuth(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rows = await prisma.setting.findMany({ where: { key: { in: ['googleSheetId','googleServiceKey'] } } })
    const cfg: Record<string,string> = {}
    for (const r of rows) cfg[r.key] = r.value

    if (!cfg.googleSheetId)    return NextResponse.json({ error: 'Google Sheet ID not configured in Settings → Integrations.' }, { status: 400 })
    if (!cfg.googleServiceKey) return NextResponse.json({ error: 'Google Service Account key not configured.' }, { status: 400 })

    let sa: { client_email: string; private_key: string }
    try { sa = JSON.parse(cfg.googleServiceKey) }
    catch { return NextResponse.json({ error: 'Service account key is not valid JSON.' }, { status: 400 }) }

    const body = await req.json().catch(() => ({}))
    const where: Record<string,unknown> = { archived: false }
    if (body.from && body.to) where.timeIn = { gte: new Date(body.from), lte: new Date(body.to) }

    const logs = await prisma.logEntry.findMany({
      where, orderBy: { timeIn: 'asc' },
      include: { pc: { select: { name: true } } },
    }) as LogRow[]

    const jwt   = await makeGoogleJWT(sa.client_email, sa.private_key)
    const token = await getGoogleAccessToken(jwt)
    const sid   = cfg.googleSheetId

    const headers = ['No.','Full Name','Agency / Organization','Purpose of Visit',
      'Equipment / Service Used','Workstation','Service Type',
      'Date','Time In','Time Out','Duration (mins)','Satisfaction Rating','Staff Notes','Entry ID']

    const dataRows = logs.map((log, i) => {
      const tout = log.timeOut ? new Date(log.timeOut) : null
      const dur  = tout ? Math.round((tout.getTime() - new Date(log.timeIn).getTime()) / 60000) : ''
      return [i+1, log.fullName, log.agency, log.purpose,
        log.equipmentUsed.join(', '), log.pc?.name || '',
        log.serviceType === 'STAFF_ASSISTED' ? 'Staff Assisted' : 'Self Service',
        format(new Date(log.timeIn),'yyyy-MM-dd'), format(new Date(log.timeIn),'hh:mm a'),
        tout ? format(tout,'hh:mm a') : 'Active', dur,
        log.satisfactionRating || '', log.staffNotes || '', log.id]
    })

    // Clear then write
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/Sheet1!A1:Z10000:clear`,
      { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' } })

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/Sheet1!A1?valueInputOption=USER_ENTERED`,
      { method:'PUT', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ values:[headers,...dataRows] }) }
    )
    if (!res.ok) { const e = await res.json(); return NextResponse.json({ error:`Sheets API: ${e.error?.message||res.statusText}` }, { status:500 }) }
    const result = await res.json()
    return NextResponse.json({ success:true, rowsWritten:dataRows.length, updatedRange:result.updatedRange })

  } catch (err) {
    console.error('[sheets/sync]', err)
    return NextResponse.json({ error:(err as Error).message||'Sync failed' }, { status:500 })
  }
}

async function makeGoogleJWT(email: string, pem: string) {
  const now = Math.floor(Date.now()/1000)
  const b64url = (s: string) => btoa(s).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
  const hdr = b64url(JSON.stringify({ alg:'RS256', typ:'JWT' }))
  const pay = b64url(JSON.stringify({ iss:email, scope:'https://www.googleapis.com/auth/spreadsheets',
    aud:'https://oauth2.googleapis.com/token', exp:now+3600, iat:now }))
  const body = `${hdr}.${pay}`
  const pemBody = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n|\r/g,'')
  const keyDer = Uint8Array.from(atob(pemBody), c=>c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', keyDer.buffer,
    { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(body))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
  return `${body}.${sigB64}`
}

async function getGoogleAccessToken(jwt: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
    body:`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  })
  const d = await res.json()
  if (!d.access_token) throw new Error(`OAuth error: ${d.error_description||d.error}`)
  return d.access_token
}
