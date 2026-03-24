/**
 * Convex seed script — creates the first SUPER_ADMIN account.
 * Run with: npm run convex:seed
 *
 * Requires NEXT_PUBLIC_CONVEX_URL to be set in your environment.
 * Run ONCE after `npx convex dev` has generated _generated/ and pushed the schema.
 */
import { ConvexHttpClient } from 'convex/browser'
import bcrypt from 'bcryptjs'

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL
if (!CONVEX_URL) {
  console.error('❌  NEXT_PUBLIC_CONVEX_URL is not set')
  process.exit(1)
}

// Import api after _generated/ exists
async function main() {
  const { api } = await import('./_generated/api')
  const client  = new ConvexHttpClient(CONVEX_URL!)

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

  console.log(`✅  Created SUPER_ADMIN:`)
  console.log(`    username : admin`)
  console.log(`    password : Dict2026`)
  console.log(`    id       : ${id}`)
  console.log(`\n    Sign in at /sign-in`)
}

main().catch(e => { console.error(e); process.exit(1) })
