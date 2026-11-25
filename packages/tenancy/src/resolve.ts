import { parseHost } from './host'
import type { DomainMap } from './domain-map'
import { PLACEHOLDER_SLUG, type DomainRecord } from './types'

export type HostResolution =
  | { kind: 'tenant'; slug: string; record: DomainRecord | null }
  | { kind: 'suspended'; slug: string }
  | { kind: 'unknown' }

const DEAD: ReadonlySet<string> = new Set(['suspended', 'cancelled', 'archived'])

/**
 * host → tenant, using only the edge map (never Postgres). Shared by proxy.ts and by server actions /
 * route handlers, which cannot use root params and must derive the tenant from the Host header.
 *
 * `strict` = the domain map is authoritative (Redis configured): hosts it does not know are unknown.
 * Otherwise (development) a well-formed platform subdomain is trusted as the slug.
 */
export async function resolveHost(
  rawHost: string | null | undefined,
  opts: { baseDomain: string; map: DomainMap; strict: boolean },
): Promise<HostResolution> {
  const parsed = parseHost(rawHost, opts.baseDomain)

  if (parsed.kind === 'marketing' || parsed.kind === 'platform_app' || parsed.kind === 'invalid') {
    return { kind: 'unknown' }
  }

  let record: DomainRecord | null = null
  if (parsed.kind === 'custom' || opts.strict) {
    record = await opts.map.get(parsed.hostname)
    if (!record) return { kind: 'unknown' }
  } else {
    record = await opts.map.get(parsed.hostname) // optional dev override
  }

  const slug = record?.slug ?? (parsed.kind === 'tenant_subdomain' ? parsed.slug : null)
  if (!slug || slug === PLACEHOLDER_SLUG) return { kind: 'unknown' }
  if (record && DEAD.has(record.status)) return { kind: 'suspended', slug }
  return { kind: 'tenant', slug, record }
}
