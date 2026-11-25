import type { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@educore/db/types'
import type { Plane } from './plane'

/**
 * Called from proxy.ts: refreshes the auth cookie and verifies the JWT locally with getClaims()
 * (asymmetric signing keys), so there is no network round trip per request.
 * Returns the claims or null. This is an OPTIMISTIC check only; the DAL re-checks on every read.
 */
export async function refreshSession(request: NextRequest, response: NextResponse, plane: Plane) {
  const supabase = createServerClient<Database>(plane.url, plane.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        }
      },
    },
  })
  const { data } = await supabase.auth.getClaims()
  return data?.claims ?? null
}
