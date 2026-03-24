// src/lib/audit.ts — write to AdminLog table
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

    const { getConvexClient } = await import('./convex-client')
    const { api }             = await import('@/convex/_generated/api')
    await getConvexClient().mutation(api.adminLogs.log, {
      action,
      adminId: opts.adminId as import('@/convex/_generated/dataModel').Id<'admins'> | undefined,
      target:  opts.target  ?? undefined,
      detail:  opts.detail ? (typeof opts.detail === 'string' ? opts.detail : JSON.stringify(opts.detail)) : undefined,
      ip,
    })
  } catch (err) {
    // Audit failures must never break the main request
    console.error('[Audit] failed to write log:', err)
  }
}
