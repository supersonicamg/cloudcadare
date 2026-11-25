import 'server-only'
import type { Sql } from '@educore/db/control'
import type { DomainRecord, TenantStatus, WritableDomainMap } from '@educore/tenancy'

/**
 * Publishes a tenant's hostnames to the edge domain map (host → routing record).
 * Call after: redeem/provision, domain verified or removed, suspend/resume/cancel.
 * Idempotent. Unverified domains are not published, so they never route.
 */
export async function syncDomainMap(sql: Sql, map: WritableDomainMap, tenantId: string): Promise<{ published: string[]; removed: string[] }> {
  const [t] = await sql<{ id: string; slug: string; status: TenantStatus; frontend: string; plane: string }[]>`
    select id, slug::text as slug, status, frontend_template_key as frontend, 'pooled-1' as plane
    from control.tenants where id = ${tenantId}`
  if (!t) return { published: [], removed: [] }
  const domains = await sql<{ hostname: string; verification_status: string }[]>`
    select hostname::text as hostname, verification_status from control.tenant_domains where tenant_id = ${tenantId}`

  const record: DomainRecord = { tenantId: t.id, slug: t.slug, planeId: t.plane, frontend: t.frontend, status: t.status }
  const published: string[] = []
  const removed: string[] = []
  for (const d of domains) {
    if (d.verification_status === 'verified' && t.status !== 'archived') {
      await map.set(d.hostname, record)
      published.push(d.hostname)
    } else {
      await map.delete(d.hostname)
      removed.push(d.hostname)
    }
  }
  return { published, removed }
}
