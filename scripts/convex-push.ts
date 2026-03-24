import './_loadEnv'
import { execSync } from 'child_process'

const url = process.env.CONVEX_URL ?? 'http://127.0.0.1:3210'
const key = process.env.CONVEX_ADMIN_KEY ?? ''

const cmd = [
  'npx convex deploy',
  `--url ${url}`,
  key ? `--admin-key "${key}"` : '',
].filter(Boolean).join(' ')

console.log(`\n> ${cmd}\n`)
execSync(cmd, { stdio: 'inherit' })
