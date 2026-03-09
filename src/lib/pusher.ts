// src/lib/pusher.ts — server-side Pusher instance
import Pusher from 'pusher'

export const pusherServer = new Pusher({
  appId:   process.env.PUSHER_APP_ID!,
  key:     process.env.PUSHER_KEY!,
  secret:  process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER || 'ap1',
  useTLS:  true,
})

// ── Channel / event names (single source of truth) ───────────────────────────
export const CHANNELS = {
  LOGBOOK: 'logbook',
} as const

export const EVENTS = {
  LOG_CREATED:   'log:created',    // new entry submitted
  LOG_UPDATED:   'log:updated',    // edit or checkout
  LOG_ARCHIVED:  'log:archived',   // soft-deleted
  PC_UPDATED:    'pc:updated',     // status/ping change
  SESSION_EXPIRY:'session:expiry', // auto-checkout fired
  STATS_UPDATE:  'stats:update',   // broadcast live counts
} as const

// Convenience wrapper — fire and forget, never throws
export async function triggerEvent(event: string, data: unknown) {
  try {
    await pusherServer.trigger(CHANNELS.LOGBOOK, event, data)
  } catch (err) {
    console.error('[Pusher] trigger failed:', err)
  }
}
