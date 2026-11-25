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
