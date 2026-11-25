import Link from 'next/link'
import { getControlSql } from '@educore/db/control'
import { controlConfigured, requireStaff } from '@/lib/session'
import { NotConfigured } from '@/lib/not-configured'

export const metadata = { title: 'Academies' }

export default async function Tenants() {
  if (!controlConfigured()) return <NotConfigured />
  const staff = await requireStaff('/tenants')
  const rows = await getControlSql()<{
    id: string; slug: string; name: string; status: string; plan: string | null; created_at: Date; host: string | null
  }[]>`
    select t.id, t.slug, t.name, t.status, p.code as plan, t.created_at,
           (select d.hostname::text from control.tenant_domains d where d.tenant_id = t.id and d.is_primary) as host
    from control.tenants t
    left join control.tenant_subscriptions s on s.tenant_id = t.id and s.status in ('trialing','active','past_due','paused')
    left join control.plans p on p.id = s.plan_id
    where t.distributor_id in (select control.distributor_subtree(${staff.distributorId}))
    order by t.created_at desc limit 200`
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Academies</h1>
      {rows.length === 0 ? (
        <p className="mt-6 text-fg/70">No academies yet. Create a license key and redeem it to make the first one.</p>
      ) : (
        <table className="mt-8 w-full text-left text-sm">
          <thead className="border-b border-border text-fg/70">
            <tr><th className="py-2 pr-4 font-medium">Name</th><th className="pr-4 font-medium">Address</th>
                <th className="pr-4 font-medium">Plan</th><th className="pr-4 font-medium">Status</th><th className="font-medium">Created</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug} className="border-b border-border">
                <td className="py-3 pr-4 font-medium">
                  <Link href={`/tenants/${r.id}`} className="text-primary underline underline-offset-2">{r.name}</Link>
                </td>
                <td className="pr-4">{r.host ?? r.slug}</td>
                <td className="pr-4">{r.plan ?? '—'}</td>
                <td className="pr-4">{r.status}</td>
                <td>{r.created_at.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
