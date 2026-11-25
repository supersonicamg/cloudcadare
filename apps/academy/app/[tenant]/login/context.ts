import 'server-only'
import { safeNext } from '@educore/core/accounts'
import { platformFor } from '@educore/ui/marks'
import { cachedCourse } from '@/lib/catalog'
import type { LoginContext } from './auth-fields'

/** `?next=` for the sign-in and sign-up pages, plus the course the visitor came from, so the page can name it. */
export async function entryContext(raw: string | string[] | undefined, tenantId: string): Promise<{ next: string; context?: LoginContext }> {
  const next = safeNext(raw)
  const slug = /^\/courses\/([^/?#]+)/.exec(next)?.[1]
  if (!slug) return { next }
  const course = await cachedCourse(tenantId, decodeURIComponent(slug))
  return { next, context: course ? { title: course.title, logo: platformFor(course.title, course.tags) } : undefined }
}
