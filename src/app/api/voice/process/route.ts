// src/app/api/voice/process/route.ts
// Process voice commands using Groq LLM

import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
})

export async function POST(req: NextRequest) {
  try {
    const { text, context } = await req.json()

    if (!text) {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      )
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'Groq API key not configured' },
        { status: 500 }
      )
    }

    // System prompt for the voice assistant
    const systemPrompt = `You are a voice assistant for the DICT DTC Client Logbook system.
Your job is to process voice commands and return structured JSON responses.

Context: ${context || 'Client logbook form'}

Available actions:
1. "show_pc_count" - When user asks about PC availability, computers, workstations
   Examples: "how many computers", "show pc status", "available workstations"
   
2. "fill_field" - When user provides personal information
   - fullName: "my name is [name]", "I am [name]", "[name] speaking"
   - agency: "from [agency]", "I work at [agency]", "representing [agency]"
   - purpose: "here for [purpose]", "need to [purpose]", "want to [purpose]"

Response format:
- PC query: { "action": "show_pc_count", "message": "Showing PC availability" }
- Name: { "action": "fill_field", "field": "fullName", "value": "Juan dela Cruz" }
- Agency: { "action": "fill_field", "field": "agency", "value": "DepEd Sorsogon" }
- Purpose: { "action": "fill_field", "field": "purpose", "value": "Online job application" }
- Other: { "action": "respond", "message": "helpful response" }

Extract names properly (capitalize first letters). Always respond with valid JSON only.`

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      model: 'llama-3.1-70b-versatile',
      temperature: 0.3,
      max_tokens: 500,
    })

    const response = completion.choices[0]?.message?.content || ''

    // Try to parse as JSON, fallback to text response
    let parsedResponse
    try {
      parsedResponse = JSON.parse(response)
    } catch {
      // If not JSON, create a text response
      parsedResponse = {
        action: 'text_response',
        message: response,
      }
    }

    return NextResponse.json({
      response: parsedResponse,
      originalText: text,
      success: true,
    })
  } catch (error) {
    console.error('Voice processing error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process voice command',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const maxDuration = 30
