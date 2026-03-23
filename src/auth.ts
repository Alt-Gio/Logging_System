import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null
        try {
          const admin = await prisma.admin.findUnique({
            where: { username: credentials.username as string },
            select: { id: true, username: true, name: true, role: true, password: true },
          })
          if (!admin) return null
          const valid = await bcrypt.compare(credentials.password as string, admin.password)
          if (!valid) return null
          await prisma.admin.update({
            where: { id: admin.id },
            data: { lastLoginAt: new Date() },
          })
          return { id: admin.id, name: admin.name, email: admin.username, role: admin.role }
        } catch {
          return null
        }
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id   = user.id ?? ''
        token.role = (user as { role?: string }).role ?? 'STAFF'
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id   = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  pages: {
    signIn: '/sign-in',
    error:  '/sign-in',
  },
})
