import { cacheLife, cacheTag } from 'next/cache'
import { notFound } from 'next/navigation'
import { tenant as tenantParam } from 'next/root-params'
import { loadTenantBundle } from '@educore/tenancy/privileged/load-tenant'

/**
 * Tenant + branding + resolved features for the current [tenant] root param.
 * Shared cache entry per slug. It holds only public data; nothing user-specific may ever enter it.
 * Invalidate with updateTag(`tenant:${id}:branding`) after branding or module changes.
 */
export async function getTenantBundle() {
  'use cache'
  const slug = await tenantParam() // undefined outside [tenant] (the /platform root layout has no params)
  if (!slug) return null
  const bundle = await loadTenantBundle(slug)
  cacheTag(`tenant:${slug}`, ...(bundle ? [`tenant:${bundle.tenant.id}:branding`] : []))
  // Do not pin "unknown tenant" for long: the academy may be created a minute later.
  if (bundle) cacheLife('hours')
  else cacheLife('seconds')
  return bundle
}

/** For pages: a layout's notFound() does not stop sibling pages from rendering, so they must check too. */
export async function requireTenantBundle() {
  const bundle = await getTenantBundle()
  if (!bundle) notFound()
  return bundle
}

/** `new Date()` is not allowed while prerendering; a cached read is. Refreshes at most daily. */
export async function getCurrentYear() {
  'use cache'
  cacheLife('days')
  return new Date().getFullYear()
}
