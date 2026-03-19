import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || '')
}

const FROM_ADDRESS = process.env.EMAIL_FROM || 'DTC Region V <noreply@dict-logbook.up.railway.app>'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const intern = await (prisma as any).intern.findUnique({ where: { id: params.id } })
    if (!intern) return NextResponse.json({ error: 'Intern not found' }, { status: 404 })
    if (!intern.email) return NextResponse.json({ error: 'Intern has no email address on file' }, { status: 400 })

    const body = await req.json()
    const { subject, message, type = 'general', senderName = 'DTC Supervisor' } = body
    if (!subject || !message) return NextResponse.json({ error: 'subject and message required' }, { status: 400 })

    const typeLabel: Record<string, string> = {
      general:    'General Message',
      reminder:   'Reminder',
      task:       'Task Assignment',
      evaluation: 'Performance Evaluation',
      attendance: 'Attendance Notice',
    }

    const typeColor: Record<string, string> = {
      general:    '#0038A8',
      reminder:   '#f59e0b',
      task:       '#7c3aed',
      evaluation: '#059669',
      attendance: '#0284c7',
    }

    const color = typeColor[type] || typeColor.general
    const label = typeLabel[type] || typeLabel.general

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f1f5f9; }
    .wrapper { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, ${color} 0%, ${color}cc 100%); padding: 32px 40px; }
    .header-top { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .header-logo { width: 44px; height: 44px; background: rgba(255,255,255,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 22px; }
    .header-title { color: white; font-size: 18px; font-weight: 700; }
    .header-sub { color: rgba(255,255,255,0.75); font-size: 12px; margin-top: 2px; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); color: white; font-size: 11px; font-weight: 600; padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.3); }
    .content { padding: 36px 40px; }
    .greeting { font-size: 22px; font-weight: 700; color: #1e293b; margin-bottom: 8px; }
    .intro { color: #64748b; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
    .message-box { background: #f8fafc; border-left: 4px solid ${color}; border-radius: 8px; padding: 20px 24px; margin-bottom: 28px; }
    .message-box p { color: #334155; font-size: 15px; line-height: 1.75; white-space: pre-wrap; }
    .info-row { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .info-chip { background: #f1f5f9; border-radius: 8px; padding: 10px 14px; flex: 1; min-width: 120px; }
    .info-chip .label { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-chip .value { font-size: 14px; color: #1e293b; font-weight: 700; margin-top: 2px; }
    .divider { height: 1px; background: #e2e8f0; margin: 24px 0; }
    .footer { background: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0; }
    .footer-text { color: #94a3b8; font-size: 12px; line-height: 1.6; text-align: center; }
    .footer-brand { color: ${color}; font-weight: 700; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-top">
        <div class="header-logo">🏛️</div>
        <div>
          <div class="header-title">DTC Region V</div>
          <div class="header-sub">Digital Transformation Center · Internship Portal</div>
        </div>
      </div>
      <span class="badge">${label}</span>
    </div>

    <div class="content">
      <div class="greeting">Hello, ${intern.fullName}! 👋</div>
      <p class="intro">You have a new message from your supervisor at the Department of Information and Communications Technology — Digital Transformation Center, Region V.</p>

      <div class="message-box">
        <p>${message.replace(/\n/g, '<br/>')}</p>
      </div>

      <div class="info-row">
        <div class="info-chip">
          <div class="label">From</div>
          <div class="value">${senderName}</div>
        </div>
        <div class="info-chip">
          <div class="label">Department</div>
          <div class="value">${intern.department || 'DTC Region V'}</div>
        </div>
        <div class="info-chip">
          <div class="label">Date</div>
          <div class="value">${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>

      <div class="divider"></div>
      <p style="color:#94a3b8;font-size:12px;line-height:1.6;">
        If you have any questions or concerns, please reach out to your supervisor directly. 
        Do not reply to this automated email.
      </p>
    </div>

    <div class="footer">
      <p class="footer-text">
        This message was sent by the <span class="footer-brand">DICT DTC Region V Internship Management System</span>.<br/>
        © ${new Date().getFullYear()} Department of Information and Communications Technology — Region V. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`

    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: intern.email,
      subject: `[DTC Interns] ${subject}`,
      html: htmlBody,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: 'Failed to send email', details: error }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id, recipient: intern.email })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
