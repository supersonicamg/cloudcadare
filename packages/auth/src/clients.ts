import { createBrowserClient, createServerClient } from '@supabase/ssr'
import type { Database } from '@educore/db/types'
import type { Plane } from './plane'

/** Cookie surface of next/headers `cookies()`; typed structurally so this package stays framework-light. */
export interface CookieStore {
  getAll(): Array<{ name: string; value: string }>
  set(name: string, value: string, options?: Record<string, unknown>): void
}

/** User-scoped client: RLS applies. Use this everywhere except the privileged folders. */
export function createServerDb(plane: Plane, cookieStore: CookieStore) {
  return createServerClient<Database>(plane.url, plane.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options)
        } catch {
          // Called from a Server Component: cookies are read-only there. proxy.ts refreshes the session.
        }
      },
    },
  })
}

export function createBrowserDb(plane: Pick<Plane, 'url' | 'publishableKey'>) {
  return createBrowserClient<Database>(plane.url, plane.publishableKey)
}
