/**
 * Supabase Client — single shared instance for the entire frontend.
 *
 * Reads the project URL and publishable (anon) key from Vite env vars:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * These are safe to expose in client code — Supabase anon keys are
 * designed for browser use and are restricted by Row Level Security.
 *
 * ⚠️  NEVER put the service_role key, database password, or SMTP
 *    credentials in frontend code or in any VITE_* variable.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Developer-facing guard: surface missing config immediately
if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [
    !supabaseUrl && 'VITE_SUPABASE_URL',
    !supabaseAnonKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
  ].filter(Boolean)

  throw new Error(
    `[CPHub] Missing Supabase environment variable(s): ${missing.join(', ')}.\n` +
    `Create a .env.local file in the repository root with:\n\n` +
    `  VITE_SUPABASE_URL=https://<your-project>.supabase.co\n` +
    `  VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>\n\n` +
    `You can find both values in the Supabase dashboard under Settings → API.`
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
