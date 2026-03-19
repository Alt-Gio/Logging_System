import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

// Lazy initialization to avoid build-time errors
function getResendClient() {
  return new Resend(process.env.RESEND_API_KEY || '')
}

function getTwilioClient() {
  const twilio = require('twilio')
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
}

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Send OTP via Email using Resend
async function sendEmailOTP(email: string, otp: string, name: string) {
  try {
    const resend = getResendClient()
    await resend.emails.send({
      from: 'DTC Region V <noreply@dict-logbook.up.railway.app>',
      to: email,
      subject: 'Your DTC Verification Code',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #0038A8 0%, #0052CC 100%); padding: 30px; text-align: center; }
              .header h1 { color: white; margin: 0; font-size: 24px; }
              .content { padding: 40px 30px; }
              .otp-box { background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px solid #0ea5e9; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
              .otp-code { font-size: 36px; font-weight: bold; color: #0369a1; letter-spacing: 8px; font-family: 'Courier New', monospace; }
              .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
              .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🏛️ DTC Region V</h1>
                <p style="color: #e0f2fe; margin: 5px 0 0 0;">Digital Transformation Center</p>
              </div>
              <div class="content">
                <h2 style="color: #1e293b; margin-top: 0;">Hello, ${name}!</h2>
                <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                  Thank you for using our services. To complete your registration, please use the verification code below:
                </p>
                <div class="otp-box">
                  <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">Your Verification Code</p>
                  <div class="otp-code">${otp}</div>
                  <p style="margin: 10px 0 0 0; color: #64748b; font-size: 12px;">Valid for 5 minutes</p>
                </div>
                <div class="warning">
                  <strong style="color: #92400e;">⚠️ Security Notice:</strong>
                  <p style="margin: 5px 0 0 0; color: #78350f;">
                    Never share this code with anyone. DTC staff will never ask for your verification code.
                  </p>
                </div>
                <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
                  If you didn't request this code, please ignore this email.
                </p>
              </div>
              <div class="footer">
                <p style="margin: 0;">Digital Transformation Center - Region V</p>
                <p style="margin: 5px 0 0 0;">Bicol, Philippines</p>
              </div>
            </div>
          </body>
        </html>
      `
    })
    return true
  } catch (error) {
    console.error('Email send error:', error)
    return false
  }
}

// Send OTP via SMS using Twilio (optional - requires Twilio setup)
async function sendSmsOTP(phone: string, otp: string) {
  // Check if Twilio is configured
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    console.warn('Twilio not configured. SMS OTP disabled.')
    return false
  }

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: twilioPhone,
        To: phone,
        Body: `Your DTC verification code is: ${otp}\n\nValid for 5 minutes. Do not share this code with anyone.\n\n- DTC Region V`
      })
    })

    if (!response.ok) {
      console.error('Twilio error:', await response.text())
      return false
    }

    return true
  } catch (error) {
    console.error('SMS send error:', error)
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { contact, contactType, purpose, name } = body

    // Validate input
    if (!contact || !contactType || !purpose || !name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (contactType !== 'email' && contactType !== 'phone') {
      return NextResponse.json(
        { error: 'Invalid contact type. Must be email or phone' },
        { status: 400 }
      )
    }

    // Rate limiting: Check if user has requested OTP recently
    const recentOtps = await prisma.otpVerification.count({
      where: {
        contact,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      }
    })

    if (recentOtps >= 3) {
      return NextResponse.json(
        { error: 'Too many OTP requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Generate OTP
    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    // Save OTP to database
    await prisma.otpVerification.create({
      data: {
        contact,
        contactType,
        otpCode: otp,
        purpose,
        expiresAt,
      }
    })

    // Send OTP
    let sent = false
    if (contactType === 'email') {
      sent = await sendEmailOTP(contact, otp, name)
    } else if (contactType === 'phone') {
      sent = await sendSmsOTP(contact, otp)
    }

    if (!sent) {
      return NextResponse.json(
        { error: `Failed to send OTP via ${contactType}. Please try again or use a different contact method.` },
        { status: 500 }
      )
    }

    // Clean up expired OTPs
    await prisma.otpVerification.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `OTP sent to your ${contactType}`,
      expiresIn: 300 // 5 minutes in seconds
    })

  } catch (error) {
    console.error('OTP send error:', error)
    return NextResponse.json(
      { error: 'Failed to send OTP' },
      { status: 500 }
    )
  }
}
