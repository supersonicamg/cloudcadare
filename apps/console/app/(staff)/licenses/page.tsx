import { getControlSql } from '@educore/db/control'
import { controlConfigured, requireStaff } from '@/lib/session'
import { NotConfigured } from '@/lib/not-configured'
import { CreateKeyForm } from './create-form'

export const metadata = { title: 'License keys' }

export default async function Licenses() {
  if (!controlConfigured()) return <NotConfigured />
  const staff = await requireStaff('/licenses')
  const sql = getControlSql()
  const plans = await sql<{ code: string; name: string }[]>`
    select p.code, p.name from control.plans p
    where p.distributor_id in (${staff.distributorId}, (select id from control.distributors where kind = 'platform'))
      and p.status = 'active'
    order by p.tier, p.name`
  const keys = await sql<{ key_hint: string; plan: string; status: string; activations: string; created_at: Date }[]>`
    select k.key_hint, p.code as plan, k.status, k.activation_count || '/' || k.max_activations as activations, k.created_at
    from control.license_keys k join control.plans p on p.id = k.plan_id
    where k.distributor_id = ${staff.distributorId}
    order by k.created_at desc limit 100`
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">License keys</h1>
      <section className="mt-8"><CreateKeyForm plans={plans} /></section>
      <h2 className="mt-14 text-xl font-semibold">Issued keys</h2>
      {keys.length === 0 ? <p className="mt-3 text-fg/70">None yet.</p> : (
        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-b border-border text-fg/70">
            <tr><th className="py-2 pr-4 font-medium">Key</th><th className="pr-4 font-medium">Plan</th>
                <th className="pr-4 font-medium">Status</th><th className="pr-4 font-medium">Used</th><th className="font-medium">Created</th></tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.key_hint + k.created_at.toISOString()} className="border-b border-border">
                <td className="py-3 pr-4 font-medium">{k.key_hint}</td><td className="pr-4">{k.plan}</td>
                <td className="pr-4">{k.status}</td><td className="pr-4">{k.activations}</td>
                <td>{k.created_at.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
