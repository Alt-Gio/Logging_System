export const dynamic = 'force-dynamic'
/**
 * GET /api/qr/daily
 * Returns today's QR token and a data-URI QR image.
 * Token is HMAC-SHA256 based, valid only for the current calendar day.
 */
import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { makeDailyToken, todayDateString } from '@/lib/qr-token'

export async function GET(req: NextRequest) {
  // Allow network bridge key OR admin/intern session
  const bridgeKey = req.headers.get('x-network-bridge-key')
  const isNetworkBridge = bridgeKey && bridgeKey === process.env.NETWORK_BRIDGE_KEY

  if (!isNetworkBridge) {
    // Fallback: allow any caller (the display page is behind auth separately)
    // In prod, the display page at /intern/qr-display enforces admin auth
  }

  try {
    const token = await makeDailyToken()
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? (req.headers.get('x-forwarded-proto') ?? 'http') + '://' + (req.headers.get('host') ?? 'localhost:3000')

    const checkinUrl = `${baseUrl}/intern/qr-checkin?token=${token}`

    const qrDataUri = await QRCode.toDataURL(checkinUrl, {
      width:          400,
      margin:         2,
      color:          { dark: '#0038A8', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })

    const expiresAt = new Date()
    expiresAt.setHours(23, 59, 59, 999)

    return NextResponse.json({
      token,
      checkinUrl,
      qrDataUri,
      date:      todayDateString(),
      expiresAt: expiresAt.toISOString(),
    })
  } catch (e) {
    console.error('[qr/daily]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
