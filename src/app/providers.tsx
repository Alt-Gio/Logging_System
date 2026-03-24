'use client'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { SessionProvider } from 'next-auth/react'

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL ?? 'http://localhost:3210',
)

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <SessionProvider>
        {children}
      </SessionProvider>
    </ConvexProvider>
  )
}
