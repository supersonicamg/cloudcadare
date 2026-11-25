import Link from 'next/link'
import { requireAccess } from '@/lib/dal'
import { money } from '@/lib/money'

export const metadata = { title: 'Orders' }

const STATUS: Record<string, string> = { pending: 'Pending', awaiting_payment: 'Awaiting payment', paid: 'Paid', partially_paid: 'Partly paid', failed: 'Failed', cancelled: 'Cancelled', refunded: 'Refunded', partially_refunded: 'Partly refunded' }

export default async function Orders() {
  const a = await requireAccess({ permission: 'order.view', feature: 'commerce.checkout' }, '/admin/orders')
  const { data } = await a.db.from('orders')
    .select('id, order_no, status, total_minor, currency, placed_at, paid_at, tenant_members(display_name, email), order_items(title_snapshot)')
    .order('placed_at', { ascending: false }).limit(100)
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v) ?? null

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
      {data?.length ? (
        <ul className="mt-8 border-t border-border">
          {data.map((o) => {
            const m = one(o.tenant_members)
            return (
              <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border py-3">
                <div>
                  <p className="font-medium">{o.order_items.map((i) => i.title_snapshot).join(', ')} <Link href={`/admin/orders/${o.id}`} className="font-normal text-fg/60 underline-offset-2 hover:text-primary hover:underline">{o.order_no}</Link></p>
                  <p className="text-sm text-fg/65">{m?.display_name} · {m?.email}</p>
                </div>
                <p className="text-right"><span className="font-medium">{money(o.total_minor, o.currency)}</span><br /><span className="text-sm text-fg/65">{STATUS[o.status] ?? o.status}</span></p>
              </li>
            )
          })}
        </ul>
      ) : <p className="mt-6 text-fg/70">No orders yet.</p>}
    </>
  )
}
