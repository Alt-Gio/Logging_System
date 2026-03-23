import { NextResponse } from 'next/server'

const clear = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge:   0,
  path:     '/',
}

export async function POST() {
  const res = NextResponse.json({ url: '/sign-in' })
  res.cookies.set('dict-session', '', clear)
  return res
}

export async function GET() {
  const base = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? 'https://www.dict.it.com'
  const res  = NextResponse.redirect(new URL('/sign-in', base))
  res.cookies.set('dict-session', '', clear)
  return res
}
