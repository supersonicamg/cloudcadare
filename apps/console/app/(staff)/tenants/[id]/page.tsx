import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  getFeatureMatrix, getTenantDetail, listAcademyStaff, listDomains, listRecentChanges,
  type AuditRow, type TenantDetail, type TenantStatus,
} from '@educore/core/tenants'
import { getControlSql } from '@educore/db/control'
import { academyUrl, formatDate, formatDateTime } from '@/lib/format'
import { canManageAcademies } from '@/lib/roles'
import { NotConfigured } from '@/lib/not-configured'
import { controlConfigured, requireStaff } from '@/lib/session'
import { Chip } from '@/lib/ui'
import { FeatureSwitch } from './feature-switch'
import { RepublishButton, ResumeButton, SuspendPanel } from './lifecycle-forms'

export const metadata: Metadata = { title: 'Academy' }

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'features', label: 'Features' },
  { key: 'people', label: 'People' },
  { key: 'domains', label: 'Domains' },
] as const
type Tab = (typeof TABS)[number]['key']

const STATUS: Record<TenantStatus, { label: string; tone: 'ok' | 'warn' | 'bad' | 'quiet' }> = {
  active: { label: 'Active', tone: 'ok' },
  trial: { label: 'Trial', tone: 'warn' },
  provisioning: { label: 'Setting up', tone: 'warn' },
  past_due: { label: 'Payment overdue', tone: 'warn' },
  suspended: { label: 'Suspended', tone: 'bad' },
  cancelled: { label: 'Cancelled', tone: 'quiet' },
  archived: { label: 'Archived', tone: 'quiet' },
}

const th = 'border-b border-border pb-2 pr-4 text-left text-[13px] font-semibold text-mute'
const td = 'border-b border-border py-3.5 pr-4 align-middle'

export default async function AcademyPage({ params, searchParams }: PageProps<'/tenants/[id]'>) {
  if (!controlConfigured()) return <NotConfigured />
  const { id } = await params
  const sp = await searchParams
  const staff = await requireStaff(`/tenants/${id}`)
  const sql = getControlSql()
  const tenant = await getTenantDetail(sql, staff.distributorId, id)
  if (!tenant) notFound()

  const tab: Tab = TABS.find((t) => t.key === sp.tab)?.key ?? 'overview'
  const manage = canManageAcademies(staff.role)
  const status = STATUS[tenant.status]
  const href = (t: Tab, extra = '') => `/tenants/${tenant.id}?tab=${t}${extra}`

  return (
    <div className="max-w-4xl">
      <Link href="/tenants" className="inline-flex items-center gap-2 text-[15px] font-semibold text-primary hover:underline">
        <span aria-hidden>←</span>Academies
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">{tenant.name}</h1>
        <div className="flex items-center gap-4">
          <Chip tone={status.tone}>{status.label}</Chip>
          {tenant.host && (
            <a href={academyUrl(tenant.host)} target="_blank" rel="noreferrer"
               className="rounded-[var(--radius)] px-3.5 py-1.5 text-sm font-semibold shadow-[inset_0_0_0_2px_var(--color-fg)] hover:bg-muted">
              Open academy <span aria-hidden>↗</span>
            </a>
          )}
        </div>
      </div>
      <p className="mt-1.5 text-fg/75">
        {[tenant.host ?? tenant.slug, tenant.planName ? `${tenant.planName} plan` : 'No plan', `Created ${formatDate(tenant.createdAt)}`].join(' · ')}
      </p>

      {tenant.status === 'suspended' && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-danger-bg px-5 py-4">
          <p className="max-w-xl text-[15px] leading-snug text-danger-ink">
            <b>Suspended on {formatDate(tenant.suspendedAt)}.</b>{' '}
            Learners and staff see “This academy is temporarily unavailable”.
            {tenant.suspensionReason && <> Note: {tenant.suspensionReason}</>}
          </p>
          {manage && <ResumeButton tenantId={tenant.id} />}
        </div>
      )}

      <nav className="mt-6 flex gap-7 border-b border-border" aria-label="Academy sections">
        {TABS.map((t) => (
          <Link key={t.key} href={href(t.key)} aria-current={t.key === tab ? 'page' : undefined}
                className="pb-2.5 text-base font-semibold text-mute hover:text-fg aria-[current=page]:text-fg aria-[current=page]:shadow-[0_3px_0_var(--color-accent)]">
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'overview' && <Overview tenant={tenant} changes={await listRecentChanges(sql, tenant.id)} />}
      {tab === 'features' && (
        <Features tenant={tenant} manage={manage} confirmSuspend={sp.confirm === 'suspend'} />
      )}
      {tab === 'people' && <People tenantId={tenant.id} />}
      {tab === 'domains' && <Domains tenantId={tenant.id} manage={manage} />}
    </div>
  )
}

// ------------------------------------------------------------------------------------------ Overview

function Overview({ tenant, changes }: { tenant: TenantDetail; changes: AuditRow[] }) {
  const facts: [string, string][] = [
    ['Owner', tenant.ownerEmail ?? '—'],
    ['Plan', tenant.planName ? `${tenant.planName}${tenant.periodEnd ? `, renews ${formatDate(tenant.periodEnd)}` : ''}` : 'No plan'],
    ...(tenant.trialEndsAt ? ([['Trial ends', formatDate(tenant.trialEndsAt)]] as [string, string][]) : []),
    ['Look and feel', words(tenant.frontend)],
    ['Type of academy', tenant.verticalKey ? words(tenant.verticalKey) : '—'],
    ['Region', `${tenant.region} · ${tenant.timezone}`],
    ['Contact email', tenant.contactEmail ?? '—'],
  ]
  return (
    <>
      <dl className="mt-6 grid max-w-2xl grid-cols-[10rem_1fr] gap-x-6 gap-y-3.5 text-[15px]">
        {facts.map(([k, v]) => (
          <div key={k} className="contents"><dt className="text-mute">{k}</dt><dd className="font-medium">{v}</dd></div>
        ))}
      </dl>
      <section className="mt-10 border-t-2 border-fg pt-5">
        <h2 className="text-xl font-semibold tracking-tight">Recent changes</h2>
        {changes.length === 0 ? (
          <p className="mt-2 text-fg/70">Nothing has been changed from the console yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-[15px]">
            {changes.map((c, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-3">
                <span><b className="font-semibold">{describeChange(c)}</b>{c.who && <span className="text-mute"> · {c.who}</span>}</span>
                <time className="text-mute" dateTime={c.at.toISOString()}>{formatDateTime(c.at)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

/** "cloud_training" → "Cloud training". */
const words = (key: string) => { const t = key.replace(/[_-]+/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1) }

const amount = (n: number, unit: string | null) =>
  `${n.toLocaleString('en-IN')}${unit ? ` ${n === 1 && unit.endsWith('s') ? unit.slice(0, -1) : unit}` : ''}`

function describeChange(c: AuditRow): string {
  const name = c.targetName ?? 'a feature'
  switch (c.action) {
    case 'feature.override.set': return `Changed ${name} for this academy`
    case 'feature.override.cleared': return `Put ${name} back to the plan`
    case 'tenant.suspended': return c.note ? `Suspended: ${c.note}` : 'Suspended'
    case 'tenant.resumed': return 'Resumed'
    default: return c.action
  }
}

// ------------------------------------------------------------------------------------------ Features

async function Features({ tenant, manage, confirmSuspend }: { tenant: TenantDetail; manage: boolean; confirmSuspend: boolean }) {
  const { groups, limits } = await getFeatureMatrix(getControlSql(), tenant.id)
  const canSuspend = manage && ['trial', 'active', 'past_due'].includes(tenant.status)
  return (
    <>
      {!manage && (
        <p className="mt-5 max-w-xl text-[15px] text-fg/75">Your role can see what this academy has, but not change it.</p>
      )}
      {groups.map((g) => (
        <section key={g.module} className="mt-8">
          <h2 className="text-xl font-semibold tracking-tight">{g.title}</h2>
          <div className="overflow-x-auto">
          <table className="mt-2 w-full text-[15px]">
            <thead><tr><th className={th}>Feature</th><th className={th}>Comes from</th><th className={`${th} text-right`}>On</th></tr></thead>
            <tbody>
              {g.rows.map((r) => (
                <tr key={r.key}>
                  <td className={td}>
                    <b className="font-semibold">{r.name}</b>
                    {r.note && !r.editable && r.label !== 'Always on' && <span className="mt-0.5 block text-sm text-mute">{r.note}</span>}
                  </td>
                  <td className={td}><Chip tone={r.tone}>{r.label}</Chip></td>
                  <td className={`${td} pr-0`}>
                    <FeatureSwitch tenantId={tenant.id} featureKey={r.key} name={r.name} on={r.enabled}
                                   editable={manage && r.editable} overridden={r.overridden} note={r.note} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
</div>
        </section>
      ))}

      {limits.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">Limits</h2>
          <p className="mt-1 text-[15px] text-fg/75">Set by the plan. Changing a limit for one academy is not available here yet.</p>
          <div className="overflow-x-auto">
          <table className="mt-2 w-full text-[15px]">
            <thead><tr><th className={th}>Limit</th><th className={th}>Comes from</th><th className={`${th} text-right`}>Value</th></tr></thead>
            <tbody>
              {limits.map((l) => (
                <tr key={l.key}>
                  <td className={td}><b className="font-semibold">{l.name}</b></td>
                  <td className={td}><Chip tone={l.tone}>{l.label}</Chip></td>
                  <td className={`${td} pr-0 text-right font-medium`}>
                    {l.value === null ? 'Unlimited' : amount(l.value, l.unit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
</div>
        </section>
      )}

      {canSuspend && (
        confirmSuspend ? (
          <SuspendPanel tenantId={tenant.id} name={tenant.name} cancelHref={`/tenants/${tenant.id}?tab=features`} />
        ) : (
          <section className="mt-12 border-t-2 border-fg pt-5">
            <h2 className="text-xl font-semibold tracking-tight">Suspend this academy</h2>
            <p className="mt-1 max-w-xl text-[15px] text-fg/75">
              Learners and staff will see “This academy is temporarily unavailable”. Nothing is deleted.
            </p>
            <Link href={`/tenants/${tenant.id}?tab=features&confirm=suspend`}
                  className="mt-4 inline-block rounded-[var(--radius)] px-3.5 py-1.5 text-sm font-semibold text-danger shadow-[inset_0_0_0_2px_var(--color-danger)] hover:bg-danger-bg">
              Suspend…
            </Link>
          </section>
        )
      )}
    </>
  )
}

// ------------------------------------------------------------------------------------------ People

async function People({ tenantId }: { tenantId: string }) {
  const { staff, activeMembers } = await listAcademyStaff(getControlSql(), tenantId)
  return (
    <section className="mt-6">
      <p className="text-[15px] text-fg/75">{activeMembers.toLocaleString('en-IN')} active {activeMembers === 1 ? 'member' : 'members'} in total.</p>
      <h2 className="mt-6 text-xl font-semibold tracking-tight">Staff</h2>
      {staff.length === 0 ? (
        <p className="mt-2 text-fg/70">No staff have signed in to this academy yet.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="mt-2 w-full text-[15px]">
          <thead><tr><th className={th}>Name</th><th className={th}>Role</th><th className={th}>Status</th><th className={`${th} pr-0 text-right`}>Last active</th></tr></thead>
          <tbody>
            {staff.map((s) => (
              <tr key={`${s.email}-${s.name}`}>
                <td className={td}><b className="font-semibold">{s.name}</b>{s.email && <span className="block text-sm text-mute">{s.email}</span>}</td>
                <td className={td}>{s.roles.join(', ')}</td>
                <td className={td}><Chip tone={s.status === 'active' ? 'ok' : 'quiet'}>{s.status === 'active' ? 'Active' : s.status}</Chip></td>
                <td className={`${td} pr-0 text-right`}>{formatDate(s.lastActive)}</td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
      )}
    </section>
  )
}

// ------------------------------------------------------------------------------------------ Domains

async function Domains({ tenantId, manage }: { tenantId: string; manage: boolean }) {
  const domains = await listDomains(getControlSql(), tenantId)
  return (
    <section className="mt-6">
      {domains.length === 0 ? (
        <p className="text-fg/70">This academy has no address yet.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-[15px]">
          <thead><tr><th className={th}>Address</th><th className={th}>Kind</th><th className={th}>Verified</th><th className={`${th} pr-0`}>Secure link</th></tr></thead>
          <tbody>
            {domains.map((d) => (
              <tr key={d.hostname}>
                <td className={td}><b className="font-semibold">{d.hostname}</b>{d.primary && <span className="ml-2 text-sm text-mute">main address</span>}</td>
                <td className={td}>{d.kind === 'custom' ? 'Own domain' : 'Platform address'}</td>
                <td className={td}><Chip tone={d.verification === 'verified' ? 'ok' : d.verification === 'failed' ? 'bad' : 'warn'}>
                  {d.verification === 'verified' ? 'Verified' : d.verification === 'failed' ? 'Failed' : 'Waiting'}</Chip></td>
                <td className={`${td} pr-0`}><Chip tone={d.ssl === 'issued' ? 'ok' : d.ssl === 'failed' ? 'bad' : 'warn'}>
                  {d.ssl === 'issued' ? 'Ready' : d.ssl === 'failed' ? 'Failed' : 'Waiting'}</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
      )}
      {manage && (
        <div className="mt-8 border-t-2 border-fg pt-5">
          <h2 className="text-xl font-semibold tracking-tight">Edge address list</h2>
          <p className="mt-1 mb-4 max-w-xl text-[15px] text-fg/75">
            The edge keeps its own copy of which address belongs to which academy. It is updated automatically when you
            suspend or resume. Press this if a change did not reach it.
          </p>
          <RepublishButton tenantId={tenantId} />
        </div>
      )}
    </section>
  )
}
