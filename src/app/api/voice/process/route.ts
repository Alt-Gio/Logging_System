// src/app/api/voice/process/route.ts
// Process voice commands using Groq LLM

import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
})

export async function POST(req: NextRequest) {
  try {
    const { text, context, history = [] } = await req.json()

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
You understand and respond in English, Tagalog, and Bicolano (Bikol). You have full access to system information.

Available navigation sections:
- "dashboard" - Main dashboard with statistics
- "logs" - Visitor log entries
- "pcs" or "stations" - PC/workstation management
- "network" or "networks" - Network scanning and monitoring
- "announcements" or "notices" - Announcements/notices management
- "analytics" - Analytics and audit logs
- "settings" - System settings

Available actions:
1. "navigate" - Navigate to a tab: { "action": "navigate", "section": "dashboard|logs|pcs|network|announcements|analytics|settings", "message": "Navigating to [section]" }
2. "show_stats" - Show dashboard statistics
3. "show_logs" - Show log entries
4. "show_pc_count" - Show PC/station status
5. "respond" - Answer questions with detailed information

Examples (multilingual):
- "Go to logs" / "Pumunta sa logs" / "Kadto sa logs" → { "action": "navigate", "section": "logs", "message": "Opening visitor logs" }
- "Show dashboard" / "Ipakita ang dashboard" → { "action": "navigate", "section": "dashboard", "message": "Opening dashboard" }
- "Go to stations" / "Pumunta sa stations" → { "action": "navigate", "section": "pcs", "message": "Opening PC stations" }
- "Open settings" / "Buksan ang settings" → { "action": "navigate", "section": "settings", "message": "Opening settings" }
- "Show network" / "Ipakita ang network" → { "action": "navigate", "section": "network", "message": "Opening network monitor" }
- "Go to analytics" / "Pumunta sa analytics" → { "action": "navigate", "section": "analytics", "message": "Opening analytics" }
- "Show notices" / "Ipakita ang notices" → { "action": "navigate", "section": "announcements", "message": "Opening announcements" }
- "How many visitors today?" / "Ilan ang bisita ngayon?" → { "action": "show_stats", "message": "Showing today's statistics" }

Recognize variations and synonyms (e.g., "stations" = "pcs", "notices" = "announcements", "networks" = "network").
Always respond with valid JSON only.`
      : `You are a helpful voice assistant for the DICT DTC Client Logbook kiosk.
You understand and respond in English, Tagalog, and Bicolano (Bikol).
You ONLY help users fill out the logbook form. Do NOT answer unrelated questions.

Allowed actions ONLY:
1. "show_pc_count" - When user asks about PC/computer availability
2. "fill_field" - Fill form fields from voice input:
   - fullName: "my name is [name]" / "ako si [name]" / "[name] an ngaran ko"
   - agency: "from [agency]" / "galing sa [agency]" / "hale sa [agency]"
   - purpose: "here for [purpose]" / "para sa [purpose]" / "para sa [purpose]"

Response format (JSON only):
- PC query: { "action": "show_pc_count", "message": "Showing available computers" }
- Name (English): { "action": "fill_field", "field": "fullName", "value": "Juan Dela Cruz" }
- Name (Tagalog): "Ako si Maria Santos" → { "action": "fill_field", "field": "fullName", "value": "Maria Santos" }
- Name (Bicolano): "Pedro Reyes an ngaran ko" → { "action": "fill_field", "field": "fullName", "value": "Pedro Reyes" }
- Agency: { "action": "fill_field", "field": "agency", "value": "DepEd Sorsogon" }
- Purpose: { "action": "fill_field", "field": "purpose", "value": "Online job application" }
- Off-topic: { "action": "respond", "message": "I can only help you fill the logbook form. Please say your name, agency, or purpose." }

Recognize multilingual input. Capitalize names properly. Extract only logbook-relevant information.
Always respond with valid JSON only.`

    const chatHistory = Array.isArray(history)
      ? history.map((m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      : []

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...chatHistory,
        { role: 'user', content: text }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.3,
      max_tokens: 512,
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
