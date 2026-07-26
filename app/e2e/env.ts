import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Local runs read app/.env.local; CI supplies these as real environment
// variables (repo secrets) and dotenv silently no-ops when the file is absent.
config({ path: resolve(__dirname, '../.env.local') })

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set — the probe suite needs a real Supabase project to run against.`)
  }
  return value
}

export const SUPABASE_URL = required('VITE_SUPABASE_URL')
export const SUPABASE_ANON_KEY = required('VITE_SUPABASE_ANON_KEY')
export const SUPABASE_SERVICE_ROLE_KEY = required('SUPABASE_SERVICE_ROLE_KEY')
