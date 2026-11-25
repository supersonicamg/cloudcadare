import { createBrowserClient, createServerClient } from '@supabase/ssr'
import type { Database } from '@educore/db/types'
import type { Plane } from './plane'

/** Cookie surface of next/headers `cookies()`; typed structurally so this package stays framework-light. */
export interface CookieStore {
  getAll(): Array<{ name: string; value: string }>
  set(name: string, value: string, options?: Record<string, unknown>): void
}

/** User-scoped client: RLS applies. Use this everywhere except the privileged folders. */
/**
 * `headers` are sent on every Auth/API call. Sign-in uses it to forward the visitor's User-Agent, so the session list
 * ("Chrome on Android") describes the learner's device and not this server.
 */
export function createServerDb(plane: Plane, cookieStore: CookieStore, opts?: { headers?: Record<string, string> }) {
  return createServerClient<Database>(plane.url, plane.publishableKey, {
    ...(opts?.headers ? { global: { headers: opts.headers } } : {}),
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
