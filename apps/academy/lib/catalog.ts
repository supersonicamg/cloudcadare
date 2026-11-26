import { cacheLife, cacheTag } from 'next/cache'
import { getPublicCourse, getPublishedCourses } from '@educore/core/catalog'

// Shared caches for anonymous pages. Keys include tenantId; nothing user-specific may enter here.
// Invalidate with updateTag(`tenant:${id}:catalog`) after any catalog write.

export async function cachedCourses(tenantId: string) {
  'use cache'
  cacheTag(`tenant:${tenantId}:catalog`)
  cacheLife('hours')
  return getPublishedCourses(tenantId)
}

export async function cachedCourse(tenantId: string, slug: string) {
  'use cache'
  cacheTag(`tenant:${tenantId}:catalog`)
  cacheLife('hours')
  return getPublicCourse(tenantId, slug)
}

/**
 * Where "the courses" are. An academy with exactly one published course (CloudCadre sells one program) goes straight to
 * it; with two or more, the catalog appears again by itself.
 */
export async function catalogLink(tenantId: string) {
  const courses = await cachedCourses(tenantId)
  const only = courses.length === 1 ? courses[0]!.slug : null
  return only ? { label: 'Program', href: `/courses/${only}`, only } : { label: 'Courses', href: '/courses', only }
}


/** True when one of these products sells a course whose price is only the first instalment (SiteContent.courseInstalments). */
export async function isFirstInstalment(tenantId: string, slugs: string[] | undefined, productIds: string[]) {
  const courses = await Promise.all((slugs ?? []).map((slug) => cachedCourse(tenantId, slug)))
  return courses.some((c) => c?.offer && productIds.includes(c.offer.productId))
}
