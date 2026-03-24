import { ConvexHttpClient } from 'convex/browser'

let _client: ConvexHttpClient | null = null

export function getConvexClient(): ConvexHttpClient {
  if (!_client) {
    // Prefer CONVEX_URL (server-side, uses internal Docker hostname in prod).
    // Fall back to NEXT_PUBLIC_CONVEX_URL for local dev where they're the same.
    const url = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL
    if (!url) throw new Error(
      'CONVEX_URL (or NEXT_PUBLIC_CONVEX_URL) is not set. ' +
      'Copy .env.local.example to .env.local and set CONVEX_URL.',
    )
    _client = new ConvexHttpClient(url)
  }
  return _client
}
