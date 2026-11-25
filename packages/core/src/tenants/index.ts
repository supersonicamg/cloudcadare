import 'server-only'
import type { Sql, TransactionSql } from '@educore/db/control'
import { describeFeature, isUuid, moduleTitle, type EntitlementSource, type MatrixCell } from './features'

export { describeFeature, isUuid, moduleTitle }
export type { EntitlementSource, MatrixCell }

// Console-side reads and writes for one academy. Every function takes the staff member's distributor and
// checks that the academy sits in that distributor's subtree, so an id from a URL is never trusted.
//
// Phase 1 runs the control schema and the academy's data in one Postgres, so People and the push to
// `public.*` (control.sync_tenant_local) use the same connection. With a separate data plane per client, the
// sync step becomes the outbox worker's job (plan/14) and the People read needs that plane's connection.

export type TenantStatus = 'provisioning' | 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'archived'

export class TenantAdminError extends Error {
  constructor(readonly code: 'not_found' | 'bad_feature' | 'not_suspendable' | 'not_suspended') {
    super(code)
    this.name = 'TenantAdminError'
  }
}

export interface TenantDetail {
  id: string
  slug: string
  name: string
  status: TenantStatus
  host: string | null
  planName: string | null
  subscriptionStatus: string | null
  periodEnd: Date | null
  ownerEmail: string | null
  contactEmail: string | null
  verticalKey: string | null
  frontend: string
  region: string
  timezone: string
  createdAt: Date
  trialEndsAt: Date | null
  suspendedAt: Date | null
  suspensionReason: string | null
}

export async function getTenantDetail(sql: Sql, distributorId: string, tenantId: string): Promise<TenantDetail | null> {
  if (!isUuid(tenantId)) return null
  const [r] = await sql<{
    id: string; slug: string; name: string; status: TenantStatus; host: string | null
    plan_name: string | null; sub_status: string | null; period_end: Date | null
    owner_email: string | null; contact_email: string | null; vertical_key: string | null
    frontend: string; region: string; timezone: string; created_at: Date; trial_ends_at: Date | null
    suspended_at: Date | null; suspension_reason: string | null
  }[]>`
    select t.id, t.slug::text as slug, t.name, t.status,
           (select d.hostname::text from control.tenant_domains d where d.tenant_id = t.id and d.is_primary) as host,
           p.name as plan_name, s.status as sub_status, s.current_period_end as period_end,
           (select u.email from auth.users u where u.id = t.owner_user_id) as owner_email,
           t.contact_email::text as contact_email, t.vertical_key, t.frontend_template_key as frontend,
           t.region, t.timezone, t.created_at, t.trial_ends_at, t.suspended_at, t.suspension_reason
    from control.tenants t
    left join lateral (
      select s2.plan_id, s2.status, s2.current_period_end from control.tenant_subscriptions s2
      where s2.tenant_id = t.id and s2.status in ('trialing', 'active', 'past_due', 'paused')
      order by s2.created_at desc limit 1
    ) s on true
    left join control.plans p on p.id = s.plan_id
    where t.id = ${tenantId} and t.distributor_id in (select control.distributor_subtree(${distributorId}))`
  if (!r) return null
  return {
    id: r.id, slug: r.slug, name: r.name, status: r.status, host: r.host, planName: r.plan_name,
    subscriptionStatus: r.sub_status, periodEnd: r.period_end, ownerEmail: r.owner_email,
    contactEmail: r.contact_email, verticalKey: r.vertical_key, frontend: r.frontend, region: r.region,
    timezone: r.timezone, createdAt: r.created_at, trialEndsAt: r.trial_ends_at, suspendedAt: r.suspended_at,
    suspensionReason: r.suspension_reason,
  }
}

// ----------------------------------------------------------------------------- features matrix

export interface MatrixRow extends MatrixCell {
  key: string
  name: string
  description: string | null
  enabled: boolean
  source: EntitlementSource
  /** An override row exists (the "Back to plan" action applies). */
  overridden: boolean
}
export interface MatrixGroup { module: string; title: string; rows: MatrixRow[] }
export interface LimitRow {
  key: string; name: string; unit: string | null; value: number | null; label: string; tone: MatrixCell['tone']
}
export interface FeatureMatrix { groups: MatrixGroup[]; limits: LimitRow[] }

export async function getFeatureMatrix(sql: Sql, tenantId: string): Promise<FeatureMatrix> {
  const rows = await sql<{
    key: string; module: string; name: string; description: string | null; kind: string; is_core: boolean
    depends_on: string[]; unit: string | null; enabled: boolean | null; limit_value: string | null
    source: EntitlementSource | null; override_enabled: boolean | null; override_limit: string | null
    has_override: boolean
  }[]>`
    select f.key, f.module, f.name, f.description, f.kind, f.is_core, f.depends_on, f.unit,
           e.enabled, e.limit_value::text as limit_value, e.source,
           o.enabled as override_enabled, o.limit_value::text as override_limit,
           (o.feature_key is not null) as has_override
    from control.features f
    left join control.tenant_entitlements e on e.tenant_id = ${tenantId} and e.feature_key = f.key
    left join control.tenant_feature_overrides o
           on o.tenant_id = ${tenantId} and o.feature_key = f.key and (o.expires_at is null or o.expires_at > now())
    where f.lifecycle <> 'deprecated'
    order by f.module, f.sort_order, f.name`

  const byKey = new Map(rows.map((r) => [r.key, r]))
  const groups = new Map<string, MatrixGroup>()
  const limits: LimitRow[] = []

  for (const r of rows) {
    const source = r.source ?? (r.is_core ? 'core' : 'default')
    const enabled = r.enabled ?? r.is_core
    if (r.kind === 'limit') {
      const cell = describeFeature({ isCore: r.is_core, enabled: true, source, missing: [] })
      limits.push({
        key: r.key, name: r.name, unit: r.unit, tone: cell.tone,
        value: r.limit_value === null ? null : Number(r.limit_value),
        label: source === 'override' ? 'Override for this academy' : source === 'default' ? 'Default' : cell.label,
      })
      continue
    }
    if (r.kind !== 'boolean') continue
    const missing = r.depends_on.filter((d) => byKey.get(d)?.enabled === false).map((d) => byKey.get(d)?.name ?? d)
    const cell = describeFeature({ isCore: r.is_core, enabled, source, missing })
    let g = groups.get(r.module)
    if (!g) groups.set(r.module, (g = { module: r.module, title: moduleTitle(r.module), rows: [] }))
    g.rows.push({
      ...cell, key: r.key, name: r.name, description: r.description, enabled, source,
      overridden: r.has_override && r.override_enabled !== null,
    })
  }
  // Core is a long list nobody can change; keep it last.
  const ordered = [...groups.values()].sort((a, b) => Number(a.module === 'core') - Number(b.module === 'core'))
  return { groups: ordered, limits }
}

interface Actor { userId: string; distributorId: string }

async function lockTenant(tx: TransactionSql, actor: Actor, tenantId: string) {
  if (!isUuid(tenantId)) throw new TenantAdminError('not_found')
  const [t] = await tx<{ id: string; status: TenantStatus; metadata: Record<string, unknown> }[]>`
    select id, status, metadata from control.tenants
    where id = ${tenantId} and distributor_id in (select control.distributor_subtree(${actor.distributorId}))
    for update`
  if (!t) throw new TenantAdminError('not_found')
  return t
}

async function audit(tx: TransactionSql, actor: Actor, tenantId: string, action: string, targetType: string, targetId: string,
                     before: Record<string, unknown>, after: Record<string, unknown>) {
  await tx`
    insert into control.audit_logs (actor_user_id, actor_distributor_id, tenant_id, action, target_type, target_id, before, after)
    values (${actor.userId}, ${actor.distributorId}, ${tenantId}, ${action}, ${targetType}, ${targetId},
            ${tx.json(before as never)}, ${tx.json(after as never)})`
}

/** Force one feature on or off for this academy only. The plan is untouched. */
export async function setFeatureOverride(
  sql: Sql, actor: Actor, input: { tenantId: string; featureKey: string; enabled: boolean; reason?: string | null },
): Promise<void> {
  await sql.begin(async (tx) => {
    await lockTenant(tx, actor, input.tenantId)
    const [f] = await tx<{ kind: string; is_core: boolean }[]>`
      select kind, is_core from control.features where key = ${input.featureKey} and lifecycle <> 'deprecated'`
    if (!f || f.kind !== 'boolean' || f.is_core) throw new TenantAdminError('bad_feature')
    const [before] = await tx<{ enabled: boolean; source: string }[]>`
      select enabled, source from control.tenant_entitlements
      where tenant_id = ${input.tenantId} and feature_key = ${input.featureKey}`
    await tx`
      insert into control.tenant_feature_overrides (tenant_id, feature_key, enabled, reason, set_by)
      values (${input.tenantId}, ${input.featureKey}, ${input.enabled}, ${input.reason ?? null}, ${actor.userId})
      on conflict (tenant_id, feature_key) do update
        set enabled = excluded.enabled, reason = excluded.reason, set_by = excluded.set_by, expires_at = null`
    await audit(tx, actor, input.tenantId, 'feature.override.set', 'feature', input.featureKey,
      { enabled: before?.enabled ?? null, source: before?.source ?? null }, { enabled: input.enabled, source: 'override' })
    await tx`select control.sync_tenant_local(${input.tenantId})`
  })
}

/** Remove this academy's override so the plan decides again. A limit override on the same row is kept. */
export async function clearFeatureOverride(
  sql: Sql, actor: Actor, input: { tenantId: string; featureKey: string },
): Promise<void> {
  await sql.begin(async (tx) => {
    await lockTenant(tx, actor, input.tenantId)
    const [before] = await tx<{ enabled: boolean | null }[]>`
      select enabled from control.tenant_feature_overrides
      where tenant_id = ${input.tenantId} and feature_key = ${input.featureKey}`
    if (!before) return
    await tx`
      update control.tenant_feature_overrides set enabled = null
      where tenant_id = ${input.tenantId} and feature_key = ${input.featureKey} and (limit_value is not null or config <> '{}'::jsonb)`
    await tx`
      delete from control.tenant_feature_overrides
      where tenant_id = ${input.tenantId} and feature_key = ${input.featureKey}
        and limit_value is null and config = '{}'::jsonb`
    await audit(tx, actor, input.tenantId, 'feature.override.cleared', 'feature', input.featureKey,
      { enabled: before.enabled }, { enabled: null })
    await tx`select control.sync_tenant_local(${input.tenantId})`
  })
}

// ----------------------------------------------------------------------------- suspend and resume

const SUSPENDABLE: ReadonlySet<TenantStatus> = new Set(['trial', 'active', 'past_due'])

/** Nothing is deleted. The caller must then run syncDomainMap so the edge shows the "unavailable" page. */
export async function suspendTenant(sql: Sql, actor: Actor, input: { tenantId: string; note: string }): Promise<void> {
  await sql.begin(async (tx) => {
    const t = await lockTenant(tx, actor, input.tenantId)
    if (!SUSPENDABLE.has(t.status)) throw new TenantAdminError('not_suspendable')
    await tx`
      update control.tenants
         set status = 'suspended', suspended_at = now(), suspension_reason = ${input.note},
             metadata = metadata || ${tx.json({ status_before_suspend: t.status } as never)}
       where id = ${input.tenantId}`
    await audit(tx, actor, input.tenantId, 'tenant.suspended', 'tenant', input.tenantId,
      { status: t.status }, { status: 'suspended', note: input.note })
    await tx`insert into control.outbox_events (tenant_id, event_type, payload)
             values (${input.tenantId}, 'tenant.suspended', ${tx.json({ tenant_id: input.tenantId } as never)})`
    await tx`select control.sync_tenant_local(${input.tenantId})`
  })
}

export async function resumeTenant(sql: Sql, actor: Actor, input: { tenantId: string }): Promise<void> {
  await sql.begin(async (tx) => {
    const t = await lockTenant(tx, actor, input.tenantId)
    if (t.status !== 'suspended') throw new TenantAdminError('not_suspended')
    const prev = t.metadata?.status_before_suspend
    const back: TenantStatus = typeof prev === 'string' && SUSPENDABLE.has(prev as TenantStatus) ? (prev as TenantStatus) : 'active'
    await tx`
      update control.tenants
         set status = ${back}, suspended_at = null, suspension_reason = null, metadata = metadata - 'status_before_suspend'
       where id = ${input.tenantId}`
    await audit(tx, actor, input.tenantId, 'tenant.resumed', 'tenant', input.tenantId, { status: 'suspended' }, { status: back })
    await tx`insert into control.outbox_events (tenant_id, event_type, payload)
             values (${input.tenantId}, 'tenant.resumed', ${tx.json({ tenant_id: input.tenantId } as never)})`
    await tx`select control.sync_tenant_local(${input.tenantId})`
  })
}

// ----------------------------------------------------------------------------- other tabs

export interface DomainRow { hostname: string; kind: string; primary: boolean; verification: string; ssl: string }
export async function listDomains(sql: Sql, tenantId: string): Promise<DomainRow[]> {
  return sql<DomainRow[]>`
    select hostname::text as hostname, kind, is_primary as "primary", verification_status as verification, ssl_status as ssl
    from control.tenant_domains where tenant_id = ${tenantId} order by is_primary desc, hostname`
}

export interface StaffRow { name: string; email: string | null; status: string; roles: string[]; lastActive: Date | null }
export async function listAcademyStaff(sql: Sql, tenantId: string): Promise<{ staff: StaffRow[]; activeMembers: number }> {
  const staff = await sql<{ name: string; email: string | null; status: string; roles: string[]; last_active: Date | null }[]>`
    select m.display_name as name, m.email::text as email, m.status,
           array_agg(r.name order by r.sort_order) as roles, m.last_active_at as last_active
    from public.tenant_members m
    join public.member_roles mr on mr.tenant_id = m.tenant_id and mr.member_id = m.id and mr.scope_type = 'tenant'
    join public.roles r on r.tenant_id = mr.tenant_id and r.id = mr.role_id and r.kind = 'staff'
    where m.tenant_id = ${tenantId}
    group by m.id order by min(r.sort_order), m.display_name limit 100`
  const [c] = await sql<{ n: number }[]>`
    select count(*)::int as n from public.tenant_members where tenant_id = ${tenantId} and status = 'active'`
  return {
    staff: staff.map((s) => ({ name: s.name, email: s.email, status: s.status, roles: s.roles, lastActive: s.last_active })),
    activeMembers: c?.n ?? 0,
  }
}

export interface AuditRow { at: Date; action: string; who: string | null; targetName: string | null; note: string | null }
export async function listRecentChanges(sql: Sql, tenantId: string, limit = 12): Promise<AuditRow[]> {
  const rows = await sql<{ occurred_at: Date; action: string; email: string | null; feature_name: string | null; note: string | null }[]>`
    select a.occurred_at, a.action, u.email, f.name as feature_name, a.after->>'note' as note
    from control.audit_logs a
    left join auth.users u on u.id = a.actor_user_id
    left join control.features f on a.target_type = 'feature' and f.key = a.target_id
    where a.tenant_id = ${tenantId} order by a.occurred_at desc limit ${limit}`
  return rows.map((r) => ({ at: r.occurred_at, action: r.action, who: r.email, targetName: r.feature_name, note: r.note }))
}
