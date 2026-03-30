export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

/**
 * POST /api/sheets/documents
 * Syncs intern document metadata to a "Intern Documents" sheet.
 * Body: { docIds?: string[] }  — if omitted, syncs all unsynced docs.
 */
export async function POST(req: NextRequest) {
  try {
    const convex      = getConvexClient()
    const allSettings = await convex.query(api.settings.getAll, {})
    const cfg: Record<string, string> = {}
    for (const r of allSettings) cfg[r.key] = r.value

    if (!cfg.googleSheetId || !cfg.googleServiceKey) {
      return NextResponse.json({ skipped: true, reason: 'Google Sheets not configured' })
    }

    let sa: { client_email: string; private_key: string }
    try { sa = JSON.parse(cfg.googleServiceKey) }
    catch { return NextResponse.json({ error: 'Invalid service account key' }, { status: 400 }) }

    const body    = await req.json().catch(() => ({}))
    const docIds: string[] | undefined = body.docIds

    const allDocs = await convex.query(api.internDocuments.getAll, {})
    const allInterns = await convex.query(api.interns.getAll, {})
    const internMap = Object.fromEntries(allInterns.map(i => [i._id, i]))

    const toSync = docIds
      ? allDocs.filter(d => docIds.includes(d._id))
      : allDocs.filter(d => !d.syncedToSheets)

    if (toSync.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: 'Nothing to sync.' })
    }

    const jwt   = await makeGoogleJWT(sa.client_email, sa.private_key)
    const token = await getGoogleAccessToken(jwt)
    const sid   = cfg.googleSheetId

    await ensureSheet(sid, token, 'Intern Documents')
    await ensureHeader(sid, token, 'Intern Documents', [
      'Document Name', 'Type', 'Tags', 'Intern Name', 'School',
      'Uploaded By', 'Document URL', 'Synced At',
    ])

    for (const doc of toSync) {
      const intern = internMap[doc.internId]
      await appendRow(sid, token, 'Intern Documents', [
        doc.name,
        doc.type,
        (doc.tags ?? []).join(', '),
        intern?.fullName ?? '—',
        intern?.school   ?? '—',
        doc.uploadedBy   ?? '—',
        doc.url,
        new Date().toLocaleString('en-PH'),
      ])
      await convex.mutation(api.internDocuments.updateSyncStatus, {
        id:             doc._id as Id<'internDocuments'>,
        syncedToSheets: true,
      })
    }

    return NextResponse.json({ success: true, synced: toSync.length })
  } catch (e) {
    console.error('[sheets/documents]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// ── Helpers (same pattern as sheets/interns) ──────────────────────────────

async function ensureSheet(sid: string, token: string, title: string) {
  const meta = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sid}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } })
  const m = await meta.json()
  if ((m.sheets ?? []).some((s: { properties?: { title?: string } }) => s.properties?.title === title)) return
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
  if (d.values?.[0]?.length) return
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
  const pay = b64url(JSON.stringify({ iss: email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now }))
  const body = `${hdr}.${pay}`
  const pemBody = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n|\r/g, '')
  const keyDer  = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', keyDer.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
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
  if (!d.access_token) throw new Error(`OAuth error: ${d.error_description ?? d.error}`)
  return d.access_token
}
