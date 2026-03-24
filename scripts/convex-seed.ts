/**
 * Convex seed script — creates the first SUPER_ADMIN account.
 * Run with:  npm run convex:seed
 *
 * Reads CONVEX_URL and CONVEX_ADMIN_KEY from .env.local / .env.
 * Run ONCE after `npm run convex:push` has deployed the schema.
 */
import './_loadEnv'
import { ConvexHttpClient } from 'convex/browser'
import bcrypt from 'bcryptjs'

const url = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL
if (!url) {
  console.error('❌  CONVEX_URL is not set. Copy .env.local.example → .env.local and fill it in.')
  process.exit(1)
}

async function main() {
  const { api } = await import('../convex/_generated/api')
  const client  = new ConvexHttpClient(url!)

  const existing = await client.query(api.admins.getByUsername, { username: 'admin' })
  if (existing) {
    console.log('ℹ️   Admin "admin" already exists — skipping seed.')
    return
  }

  const passwordHash = await bcrypt.hash('Dict2026', 12)
  const id = await client.mutation(api.admins.create, {
    username:     'admin',
    passwordHash,
    name:         'System Admin',
    role:         'SUPER_ADMIN',
  })

  console.log('✅  Created SUPER_ADMIN:')
  console.log('    username : admin')
  console.log('    password : Dict2026  ← change this immediately')
  console.log(`    id       : ${id}`)
  console.log('\n    Sign in at /sign-in')
}

main().catch(e => { console.error(e); process.exit(1) })
