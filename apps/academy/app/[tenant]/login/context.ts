import 'server-only'
import { safeNext } from '@educore/core/accounts'
import { cachedCourse } from '@/lib/catalog'
import type { LoginContext } from './auth-fields'

/** The /login or /signup address that keeps the page the visitor was heading to. */
export const withNext = (path: '/login' | '/signup', next: string) => (next === '/' ? path : `${path}?next=${encodeURIComponent(next)}`)

/** `?next=` for the sign-in and sign-up pages, plus the course the visitor came from, so the page can name it. */
export async function entryContext(raw: string | string[] | undefined, tenantId: string): Promise<{ next: string; context?: LoginContext }> {
  const next = safeNext(raw)
  const slug = /^\/courses\/([^/?#]+)/.exec(next)?.[1]
  if (!slug) return { next }
  const course = await cachedCourse(tenantId, decodeURIComponent(slug))
  return { next, context: course ? { title: course.title } : undefined }
}
