/**
 * Minimal .env / .env.local loader for standalone tsx scripts.
 * Reads the files in order (later values do NOT override earlier ones, matching dotenv behaviour).
 * tsconfig excludes the scripts/ dir so this file is never compiled into the Next.js bundle.
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

function parseEnvFile(file: string) {
  if (!existsSync(file)) return
  const lines = readFileSync(file, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const raw = trimmed.slice(eqIdx + 1).trim()
    const val = raw.replace(/^["']|["']$/g, '')
    if (key && !(key in process.env)) {
      process.env[key] = val
    }
  }
}

const root = resolve(process.cwd())
parseEnvFile(resolve(root, '.env.local'))
parseEnvFile(resolve(root, '.env'))
