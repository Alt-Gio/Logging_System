import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { getConvexClient } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'

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
          const convex = getConvexClient()
          const admin  = await convex.query(api.admins.getByUsername, {
            username: (credentials.username as string).trim().toLowerCase(),
          })
          if (!admin) return null
          const valid = await bcrypt.compare(credentials.password as string, admin.passwordHash)
          if (!valid) return null
          convex.mutation(api.admins.updateLastLogin, { id: admin._id }).catch(() => {})
          return { id: admin._id, name: admin.name, email: admin.username, role: admin.role }
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
