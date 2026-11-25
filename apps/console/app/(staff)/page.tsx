import Link from 'next/link'
import { getControlSql } from '@educore/db/control'
import { controlConfigured, requireStaff } from '@/lib/session'
import { NotConfigured } from '@/lib/not-configured'

export default async function Overview() {
  if (!controlConfigured()) return <NotConfigured />
  const staff = await requireStaff('/')
  const sql = getControlSql()
  const [t] = await sql<{ total: number; live: number }[]>`
    select count(*)::int as total, count(*) filter (where status in ('active','trial'))::int as live
    from control.tenants where distributor_id in (select control.distributor_subtree(${staff.distributorId}))`
  const [k] = await sql<{ open: number }[]>`
    select count(*)::int as open from control.license_keys
    where distributor_id = ${staff.distributorId} and status = 'active'`
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">{staff.distributorName}</h1>
      <p className="mt-2 text-fg/70">Signed in as {staff.email} ({staff.role}).</p>
      <dl className="mt-10 grid max-w-xl grid-cols-2 gap-10">
        <div>
          <dt className="text-sm text-fg/70">Academies live</dt>
          <dd className="mt-1 text-4xl font-semibold">{t?.live ?? 0}</dd>
          <dd className="mt-1 text-sm text-fg/60">of {t?.total ?? 0} created</dd>
        </div>
        <div>
          <dt className="text-sm text-fg/70">License keys unused</dt>
          <dd className="mt-1 text-4xl font-semibold">{k?.open ?? 0}</dd>
          <dd className="mt-1 text-sm"><Link href="/licenses" className="text-primary underline">Create a key</Link></dd>
        </div>
      </dl>
    </>
  )
}
