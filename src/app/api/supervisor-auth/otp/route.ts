export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { Resend } from 'resend'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-fallback-secret-change-me-00000')
}
function makeOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// POST /api/supervisor-auth/otp  { action: 'request', email }
// POST /api/supervisor-auth/otp  { action: 'verify',  email, code }
export async function POST(req: NextRequest) {
  try {
    const { action, email, code } = await req.json()
    const normalEmail = (email as string || '').toLowerCase().trim()
    if (!normalEmail) return NextResponse.json({ error: 'email required' }, { status: 400 })

    const convex  = getConvexClient()
    const supervisor = await convex.query(api.supervisors.getByEmail, { email: normalEmail })
    if (!supervisor) return NextResponse.json({ error: 'No supervisor account found for this email.' }, { status: 404 })
    if (!supervisor.emailVerified) return NextResponse.json({ error: 'Account not yet activated. Check your invitation email.' }, { status: 403 })

    if (action === 'request') {
      const otp       = makeOtp()
      const expiresAt = Date.now() + 10 * 60_000 // 10 min
      await convex.mutation(api.supervisors.upsertOtp, { email: normalEmail, code: otp, expiresAt })

      const resend = new Resend(process.env.RESEND_API_KEY || '')
      const from   = process.env.EMAIL_FROM || 'DTC Region V <noreply@dict.it.com>'
      await resend.emails.send({
        from,
        to:      normalEmail,
        subject: 'Your DICT DTC Login Code',
        html: `
          <!DOCTYPE html><html><head>
          <style>body{font-family:'Segoe UI',sans-serif;background:#f5f5f5;margin:0;padding:20px}
          .c{max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1)}
          .h{background:linear-gradient(135deg,#0038A8,#0052CC);padding:28px;text-align:center;color:#fff}
          .b{padding:36px 32px;text-align:center}
          .code{font-size:42px;font-weight:900;letter-spacing:10px;color:#0038A8;background:#f0f4ff;border-radius:12px;padding:16px 24px;display:inline-block;margin:20px 0}
          .f{background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8}</style>
          </head><body><div class="c">
          <div class="h"><h2 style="margin:0">🏛️ DICT DTC Supervisor Portal</h2><p style="color:#e0f2fe;margin:6px 0 0;font-size:14px">Digital Transformation Center — Region V</p></div>
          <div class="b">
            <p style="color:#475569;font-size:16px;margin-top:0">Hello, <strong>${supervisor.name}</strong>!</p>
            <p style="color:#64748b;font-size:14px">Use this one-time code to sign in to the Supervisor Portal:</p>
            <div class="code">${otp}</div>
            <p style="color:#94a3b8;font-size:13px;margin-bottom:0">This code expires in <strong>10 minutes</strong>.<br>If you did not request this, you can safely ignore this email.</p>
          </div>
          <div class="f"><p>Digital Transformation Center — Region V · Legazpi City, Albay</p></div>
          </div></body></html>
        `,
      })

      return NextResponse.json({ ok: true, message: 'OTP sent to your email' })
    }

    if (action === 'verify') {
      if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })
      const result = await convex.mutation(api.supervisors.verifyOtp, { email: normalEmail, code: String(code) })
      if (!result.ok) return NextResponse.json({ error: result.error || 'Invalid code' }, { status: 401 })

      await convex.mutation(api.supervisors.update, { id: supervisor._id, lastLogin: Date.now() })

      const jwt = await new SignJWT({
        id:         supervisor._id,
        email:      supervisor.email,
        name:       supervisor.name,
        department: supervisor.department,
        role:       'SUPERVISOR',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(getSecret())

      const res = NextResponse.json({
        ok: true,
        supervisor: { id: supervisor._id, email: supervisor.email, name: supervisor.name, department: supervisor.department },
      })
      res.cookies.set('supervisor-session', jwt, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   60 * 60 * 24,
        path:     '/',
      })
      return res
    }

    return NextResponse.json({ error: 'action must be request or verify' }, { status: 400 })
  } catch (e) {
    console.error('[supervisor-auth/otp]', e)
    return NextResponse.json({ error: 'OTP operation failed' }, { status: 500 })
  }
}
