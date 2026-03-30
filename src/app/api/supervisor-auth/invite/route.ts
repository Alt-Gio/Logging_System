import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import { Resend } from 'resend'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })
    const convex = getConvexClient()
    const supervisor = await convex.query(api.supervisors.getByInviteToken, { token })
    if (!supervisor) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    if (supervisor.inviteExpiry && supervisor.inviteExpiry < Date.now()) {
      return NextResponse.json({ error: 'Invite expired' }, { status: 410 })
    }
    return NextResponse.json({ email: supervisor.email, name: supervisor.name })
  } catch {
    return NextResponse.json({ error: 'Failed to look up invite' }, { status: 500 })
  }
}

function getResend() { return new Resend(process.env.RESEND_API_KEY || '') }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, name, department, adminId, phone, position, schoolId } = body
    if (!email || !name || !department) {
      return NextResponse.json({ error: 'email, name, and department required' }, { status: 400 })
    }

    const convex = getConvexClient()
    const existing = await convex.query(api.supervisors.getByEmail, { email: email.toLowerCase().trim() })
    if (existing) return NextResponse.json({ error: 'Supervisor already exists' }, { status: 409 })

    const token  = crypto.randomBytes(32).toString('hex')
    const expiry = Date.now() + 72 * 60 * 60_000 // 72 hours

    await convex.mutation(api.supervisors.create, {
      email:        email.toLowerCase().trim(),
      name,
      department,
      phone:        phone as string | undefined,
      position:     position as string | undefined,
      schoolId:     schoolId as never,
      adminId:      adminId || undefined,
      inviteToken:  token,
      inviteExpiry: expiry,
    })

    const setupUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://dict.it.com'}/supervisor/setup?token=${token}`
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://dict.it.com'}/supervisor/login`
    const from     = process.env.EMAIL_FROM || 'DTC Region V <noreply@dict.it.com>'

    await getResend().emails.send({
      from,
      to:      email,
      subject: 'Your DICT DTC Supervisor Account Invitation',
      html: `
        <!DOCTYPE html><html><head>
        <style>body{font-family:'Segoe UI',sans-serif;background:#f5f5f5;margin:0;padding:20px}
        .c{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1)}
        .h{background:linear-gradient(135deg,#0038A8,#0052CC);padding:30px;text-align:center;color:#fff}
        .b{padding:40px 30px}.btn{display:inline-block;background:#0038A8;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px}
        .badge{display:inline-block;background:#e0f2fe;color:#0369a1;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:8px}
        .f{background:#f8fafc;padding:20px;text-align:center;font-size:12px;color:#64748b}</style>
        </head><body><div class="c">
        <div class="h"><h1>🏛️ DICT DTC Supervisor Portal</h1><p style="color:#e0f2fe;margin:5px 0 0">Digital Transformation Center — Region V</p></div>
        <div class="b">
          <span class="badge">Practicum Coordinator Invitation</span>
          <h2 style="color:#1e293b;margin-top:8px">Hello, ${name}!</h2>
          <p style="color:#475569;font-size:16px;line-height:1.6">
            You've been invited as a <strong>Practicum Coordinator / Supervisor</strong> for the
            DICT DTC Intern Management System. Click below to confirm and activate your account.
          </p>
          <div style="text-align:center;margin:32px 0">
            <a href="${setupUrl}" class="btn">Confirm &amp; Activate Account</a>
          </div>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
          <p style="color:#64748b;font-size:14px;line-height:1.6">
            Once activated, you can log in at any time at <a href="${loginUrl}" style="color:#0038A8">${loginUrl}</a>
            using your email address. A one-time OTP code will be sent to your email each time you sign in — <strong>no password required</strong>.
          </p>
          <p style="color:#94a3b8;font-size:12px">This invite link expires in 72 hours.</p>
        </div>
        <div class="f"><p>Digital Transformation Center — Region V · Legazpi City, Albay</p></div>
        </div></body></html>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[supervisor-auth/invite]', e)
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 })
  }
}
