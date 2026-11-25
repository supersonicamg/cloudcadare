import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@educore/db/types'
import type { Plane } from '../plane'

/**
 * SERVICE-ROLE client. Bypasses RLS. ESLint only allows importing this module from a /privileged/
 * folder or apps/workers (packages/config/eslint.mjs). Never pass its results to the browser unfiltered.
 */
export function createPrivilegedDb(plane: Plane) {
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!secret) throw new Error('Missing env SUPABASE_SECRET_KEY')
  return createClient<Database>(plane.url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
}
