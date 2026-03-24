import './_loadEnv'
import { execSync } from 'child_process'

const url  = process.env.CONVEX_URL ?? 'http://127.0.0.1:3210'
const key  = process.env.CONVEX_ADMIN_KEY ?? ''
const once = process.argv.includes('--once')

const cmd = [
  'npx convex dev',
  `--url ${url}`,
  key  ? `--admin-key "${key}"` : '',
  once ? '--once' : '',
].filter(Boolean).join(' ')

console.log(`\n> ${cmd}\n`)
execSync(cmd, { stdio: 'inherit' })
