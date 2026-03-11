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

    // Context-aware system prompts
    const isAdmin = context === 'admin'
    const systemPrompt = isAdmin
      ? `You are an expert admin voice assistant for the DICT DTC Client Logbook system.
You have full access to system information and can answer detailed administrative queries.

Available actions and examples:
1. "show_pc_count" - PC status, availability, workstation queries
2. "show_stats" - Show dashboard statistics (visitors today, active sessions, usage)
3. "show_logs" - Show recent log entries or filter by name/agency
4. "navigate" - Navigate to a section: { "action": "navigate", "section": "pcs|logs|announcements|settings|audit" }
5. "respond" - Answer questions about the system with detailed information

Examples of admin queries and responses:
- "How many people visited today?" → { "action": "show_stats", "message": "Showing today's visitor statistics" }
- "Show active sessions" → { "action": "show_logs", "filter": "active", "message": "Showing active sessions" }
- "Go to PC management" → { "action": "navigate", "section": "pcs", "message": "Navigating to PC management" }
- "Show announcements" → { "action": "navigate", "section": "announcements", "message": "Opening announcements" }
- "How many PCs are online?" → { "action": "show_pc_count", "message": "Showing PC status overview" }
- "Show audit logs" → { "action": "navigate", "section": "audit", "message": "Opening audit trail" }
- "Who logged in last?" → { "action": "show_logs", "filter": "recent", "message": "Showing recent entries" }

Respond with detailed, professional information. Extract proper names and data.
Always respond with valid JSON only.`
      : `You are a helpful voice assistant for the DICT DTC Client Logbook kiosk.
You ONLY help users fill out the logbook form. Do NOT answer unrelated questions.

Allowed actions ONLY:
1. "show_pc_count" - When user asks about PC/computer availability
2. "fill_field" - Fill form fields from voice input:
   - fullName: "my name is [name]", "I am [name]", "[name] speaking"
   - agency: "from [agency]", "I work at [agency]", "representing [agency]"  
   - purpose: "here for [purpose]", "I need to [purpose]", "to [purpose]"

Response format (JSON only):
- PC query: { "action": "show_pc_count", "message": "Showing available computers" }
- Name: { "action": "fill_field", "field": "fullName", "value": "Juan Dela Cruz" }
- Agency: { "action": "fill_field", "field": "agency", "value": "DepEd Sorsogon" }
- Purpose: { "action": "fill_field", "field": "purpose", "value": "Online job application" }
- Off-topic: { "action": "respond", "message": "I can only help you fill the logbook form. Please say your name, agency, or purpose." }

Capitalize names properly. Extract only logbook-relevant information. Always respond with valid JSON only.`

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
