/**
 * QR daily token utilities — shared between /api/qr/daily and /api/intern-sessions/qr-checkin
 * Token format: YYYYMMDD_<HMAC-SHA256(YYYYMMDD, QR_CHECKIN_SECRET).hex[:16]>
 * Valid only on the calendar date it was generated.
 */

export function todayDateString(): string {
  const d   = new Date()
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export async function makeDailyToken(dateStr?: string): Promise<string> {
  const secret = process.env.QR_CHECKIN_SECRET ?? 'dev-qr-secret-change-me'
  const date   = dateStr ?? todayDateString()
  const key    = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(date))
  const hex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `${date}_${hex.slice(0, 16)}`
}

export async function verifyDailyToken(token: string): Promise<boolean> {
  const parts   = token.split('_')
  if (parts.length !== 2 || parts[0].length !== 8) return false
  const dateStr = parts[0]
  if (dateStr !== todayDateString()) return false
  const expected = await makeDailyToken(dateStr)
  return token === expected
}
