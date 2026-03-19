import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { contact, otpCode } = body

    // Validate input
    if (!contact || !otpCode) {
      return NextResponse.json(
        { error: 'Missing contact or OTP code' },
        { status: 400 }
      )
    }

    // Find the most recent unverified OTP for this contact
    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        contact,
        verified: false,
        expiresAt: {
          gt: new Date() // Not expired
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (!otpRecord) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP code' },
        { status: 400 }
      )
    }

    // Verify OTP code
    if (otpRecord.otpCode !== otpCode) {
      return NextResponse.json(
        { error: 'Incorrect OTP code' },
        { status: 400 }
      )
    }

    // Mark OTP as verified
    await prisma.otpVerification.update({
      where: {
        id: otpRecord.id
      },
      data: {
        verified: true
      }
    })

    // Clean up old OTPs for this contact
    await prisma.otpVerification.deleteMany({
      where: {
        contact,
        id: {
          not: otpRecord.id
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
      verificationId: otpRecord.id
    })

  } catch (error) {
    console.error('OTP verify error:', error)
    return NextResponse.json(
      { error: 'Failed to verify OTP' },
      { status: 500 }
    )
  }
}
