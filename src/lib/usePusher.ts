// src/lib/usePusher.ts — client-side real-time hook
'use client'
import { useEffect, useRef } from 'react'
import Pusher from 'pusher-js'
import { CHANNELS, EVENTS } from './pusher'

type PusherCallbacks = {
  onLogCreated?:   (data: unknown) => void
  onLogUpdated?:   (data: unknown) => void
  onLogArchived?:  (data: unknown) => void
  onPcUpdated?:    (data: unknown) => void
  onSessionExpiry?:(data: unknown) => void
  onStatsUpdate?:  (data: unknown) => void
}

export function usePusher(callbacks: PusherCallbacks) {
  const pusherRef = useRef<Pusher | null>(null)

  useEffect(() => {
    const key     = process.env.NEXT_PUBLIC_PUSHER_KEY
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap1'
    if (!key) return // Pusher not configured — skip silently

    const pusher  = new Pusher(key, { cluster })
    pusherRef.current = pusher
    const channel = pusher.subscribe(CHANNELS.LOGBOOK)

    if (callbacks.onLogCreated)   channel.bind(EVENTS.LOG_CREATED,   callbacks.onLogCreated)
    if (callbacks.onLogUpdated)   channel.bind(EVENTS.LOG_UPDATED,   callbacks.onLogUpdated)
    if (callbacks.onLogArchived)  channel.bind(EVENTS.LOG_ARCHIVED,  callbacks.onLogArchived)
    if (callbacks.onPcUpdated)    channel.bind(EVENTS.PC_UPDATED,    callbacks.onPcUpdated)
    if (callbacks.onSessionExpiry)channel.bind(EVENTS.SESSION_EXPIRY,callbacks.onSessionExpiry)
    if (callbacks.onStatsUpdate)  channel.bind(EVENTS.STATS_UPDATE,  callbacks.onStatsUpdate)

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(CHANNELS.LOGBOOK)
      pusher.disconnect()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

export { EVENTS }
