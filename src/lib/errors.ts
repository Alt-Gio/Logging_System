// src/lib/errors.ts — safe error handling, never leaks internals
import { NextResponse } from 'next/server'

export class AppError extends Error {
  constructor(public message: string, public status: number = 400) {
    super(message)
  }
}

// Wraps any async route handler, catches all errors safely
export function withErrorHandler(
  handler: (req: Request, ctx?: unknown) => Promise<NextResponse>
) {
  return async (req: Request, ctx?: unknown) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      // Log internally but NEVER expose stack traces or DB errors to client
      console.error('[API Error]', req.url, err instanceof Error ? err.message : err)
      return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
    }
  }
}

// IP validation — strict RFC 1918 + loopback + public IPv4
const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/
export function validateIpAddress(ip: string): string {
  if (!IP_REGEX.test(ip)) throw new AppError('Invalid IP address format', 400)
  const parts = ip.split('.').map(Number)
  if (parts.some(p => p < 0 || p > 255)) throw new AppError('Invalid IP address range', 400)
  // Block obviously dangerous values
  if (ip === '0.0.0.0' || parts[3] === 0 || parts[3] === 255) {
    throw new AppError('Invalid IP address', 400)
  }
  return ip
}
