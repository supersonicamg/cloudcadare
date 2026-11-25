import Link from 'next/link'
import { requireAccess } from '@/lib/dal'
import { money } from '@/lib/money'
import { chipClass, td, th, tableWrap } from '@/lib/ui'
import { PageHeader, Tabs } from '../_components/ui'
import { paymentPages, waitingPayments } from '../_components/sections'

export const metadata = { title: 'Orders' }

const STATUS: Record<string, string> = { pending: 'Pending', awaiting_payment: 'Awaiting payment', paid: 'Paid', partially_paid: 'Partly paid', failed: 'Failed', cancelled: 'Cancelled', refunded: 'Refunded', partially_refunded: 'Partly refunded' }
const TONE = { paid: 'ok', awaiting_payment: 'warn', pending: 'warn', partially_paid: 'warn', failed: 'bad', cancelled: 'quiet', refunded: 'info', partially_refunded: 'info' } as const
const date = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export default async function Orders() {
  const a = await requireAccess({ permission: 'order.view', feature: 'commerce.checkout' }, '/admin/orders')
  const { data } = await a.db.from('orders')
    .select('id, order_no, status, total_minor, currency, placed_at, paid_at, tenant_members(display_name, email), order_items(title_snapshot)')
    .order('placed_at', { ascending: false }).limit(100)
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v) ?? null

  return (
    <>
      <PageHeader title="Payments" lead="Your latest 100 orders. Open one to see the payment or give a refund." />
      <Tabs label="Payments" current="/admin/orders" items={paymentPages(a, await waitingPayments(a))} />
      {data?.length ? (
        <div className={`${tableWrap} rounded-[20px] bg-white p-5 ring-1 ring-border`}>
          <table className="w-full text-[15px]">
            <thead className="border-t-2 border-fg">
              <tr><th className={th}>Order</th><th className={th}>Learner</th><th className={`${th} text-right`}>Total</th><th className={th}>Status</th><th className={`${th} hidden text-right md:table-cell`}>Placed</th></tr>
            </thead>
            <tbody>
              {data.map((o) => {
                const m = one(o.tenant_members)
                return (
                  <tr key={o.id}>
                    <td className={td}>
                      <Link href={`/admin/orders/${o.id}`} className="font-bold text-primary hover:underline">{o.order_items.map((i) => i.title_snapshot).join(', ') || o.order_no}</Link>
                      <span className="block text-sm text-mute">{o.order_no}</span>
                    </td>
                    <td className={td}>{m?.display_name}<span className="block break-all text-sm text-mute">{m?.email}</span></td>
                    <td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums`}>{money(o.total_minor, o.currency)}</td>
                    <td className={td}><span className={chipClass(TONE[o.status as keyof typeof TONE] ?? 'quiet')}>{STATUS[o.status] ?? o.status}</span></td>
                    <td className={`${td} hidden whitespace-nowrap text-right md:table-cell`}>{date.format(new Date(o.placed_at))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="border-t-2 border-fg pt-6 text-[17px] text-grey">No orders yet. They appear here as soon as a learner starts to check out.</p>}
    </>
  )
}
