export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import { Resend } from 'resend'
import type { Id } from '@/convex/_generated/dataModel'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })
    const convex = getConvexClient()
    const account = await convex.query(api.internAccounts.getByInviteToken, { token })
    if (!account) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    if (account.inviteExpiry && account.inviteExpiry < Date.now()) {
      return NextResponse.json({ error: 'Invite expired' }, { status: 410 })
    }
    const intern = await convex.query(api.interns.getById, { id: account.internId })
    return NextResponse.json({ email: account.email, name: intern?.fullName ?? '' })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to look up invite' }, { status: 500 })
  }
}

function getResend() { return new Resend(process.env.RESEND_API_KEY || '') }

export async function POST(req: NextRequest) {
  try {
    const { internId, supervisorId, email } = await req.json()
    if (!internId || !email) {
      return NextResponse.json({ error: 'internId and email required' }, { status: 400 })
    }

    const convex = getConvexClient()
    const intern = await convex.query(api.interns.getById, { id: internId as Id<'interns'> })
    if (!intern) return NextResponse.json({ error: 'Intern not found' }, { status: 404 })

    const existing = await convex.query(api.internAccounts.getByEmail, { email: email.toLowerCase().trim() })
    if (existing) return NextResponse.json({ error: 'Account already exists for this email' }, { status: 409 })

    const token      = crypto.randomBytes(32).toString('hex')
    const expiry     = Date.now() + 48 * 60 * 60_000 // 48 hours

    await convex.mutation(api.internAccounts.create, {
      internId:     internId as Id<'interns'>,
      supervisorId: supervisorId as Id<'supervisors'> | undefined,
      email:        email.toLowerCase().trim(),
      passwordHash: '',
      inviteToken:  token,
      inviteExpiry: expiry,
    })

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://dict.it.com'}/intern/setup?token=${token}`
    const from = process.env.EMAIL_FROM || 'DTC Region V <noreply@dict.it.com>'

    await getResend().emails.send({
      from,
      to:      email,
      subject: "You've been invited to DICT DTC Intern Portal",
      html: `
        <!DOCTYPE html><html><head>
        <style>body{font-family:'Segoe UI',sans-serif;background:#f5f5f5;margin:0;padding:20px}
        .c{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1)}
        .h{background:linear-gradient(135deg,#0038A8,#0052CC);padding:30px;text-align:center;color:#fff}
        .b{padding:40px 30px}.btn{display:inline-block;background:#0038A8;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px}
        .f{background:#f8fafc;padding:20px;text-align:center;font-size:12px;color:#64748b}</style>
        </head><body><div class="c">
        <div class="h"><h1>🎓 DICT DTC Intern Portal</h1><p style="color:#e0f2fe;margin:5px 0 0">Digital Transformation Center — Region V</p></div>
        <div class="b">
          <h2 style="color:#1e293b;margin-top:0">Hello, ${intern.fullName}!</h2>
          <p style="color:#475569;font-size:16px;line-height:1.6">
            You've been invited to join the <strong>DICT DTC Gamified Intern Portal</strong>. 
            Track your hours, complete tasks, earn XP, and level up your OJT experience!
          </p>
          <div style="text-align:center;margin:32px 0">
            <a href="${inviteUrl}" class="btn">✨ Accept Invitation</a>
          </div>
          <p style="color:#94a3b8;font-size:13px">This invite link expires in 48 hours.</p>
        </div>
        <div class="f"><p>Digital Transformation Center — Region V · Legazpi City, Albay</p></div>
        </div></body></html>
      `,
    })

    return NextResponse.json({ ok: true, token })
  } catch (e) {
    console.error('[intern-auth/invite]', e)
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 })
  }
}
