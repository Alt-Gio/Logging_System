// src/lib/audit.ts — write to AdminLog table
import { prisma } from './prisma'
import { NextRequest } from 'next/server'

type AuditAction =
  | 'LOGIN' | 'LOGOUT'
  | 'CREATE_LOG' | 'EDIT_LOG' | 'CHECKOUT' | 'ARCHIVE_LOG'
  | 'CREATE_PC' | 'EDIT_PC' | 'DELETE_PC'
  | 'CHANGE_SETTING'
  | 'CREATE_CAMERA' | 'DELETE_CAMERA'
  | 'AUTO_CHECKOUT'

export async function audit(
  action: AuditAction,
  opts: {
    req?:     NextRequest
    target?:  string
    detail?:  string | Record<string, unknown>
    adminId?: string
  } = {}
) {
  try {
    const ip = opts.req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? opts.req?.headers.get('x-real-ip')
      ?? 'unknown'

    await prisma.adminLog.create({
      data: {
        action,
        adminId: opts.adminId ?? null,
        target:  opts.target  ?? null,
        detail:  opts.detail ? (typeof opts.detail === 'string' ? opts.detail : JSON.stringify(opts.detail)) : null,
        ip,
      },
    })
  } catch (err) {
    // Audit failures must never break the main request
    console.error('[Audit] failed to write log:', err)
  }
}
