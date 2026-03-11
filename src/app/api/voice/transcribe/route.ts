// src/app/api/voice/transcribe/route.ts
// Groq Whisper API integration for voice transcription

import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
})

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'Groq API key not configured' },
        { status: 500 }
      )
    }

    // Convert File to Buffer for Groq API
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Create a new File object with the buffer
    const file = new File([buffer], audioFile.name, { type: audioFile.type })

    // Transcribe using Groq Whisper (supports multilingual: English, Tagalog, Bicolano)
    const transcription = await groq.audio.transcriptions.create({
      file: file,
      model: 'whisper-large-v3-turbo',
      response_format: 'json',
      temperature: 0.0,
    })

    return NextResponse.json({
      text: transcription.text,
      success: true,
    })
  } catch (error) {
    console.error('Transcription error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to transcribe audio',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const maxDuration = 30
