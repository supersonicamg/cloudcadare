import Link from 'next/link'
import { requireMember } from '@/lib/dal'
import { money } from '@/lib/money'
import { getShell } from '@/lib/shell'
import { chipClass, h1s, ruleTop } from '@/lib/ui'
import { AccountNav } from '../_components/account-nav'

export const metadata = { title: 'My orders' }

const STATUS: Record<string, [string, 'ok' | 'warn' | 'bad' | 'quiet']> = {
  pending: ['Pending', 'warn'], awaiting_payment: ['Not paid', 'warn'], paid: ['Paid', 'ok'], partially_paid: ['Partly paid', 'warn'],
  failed: ['Payment failed', 'bad'], cancelled: ['Cancelled', 'quiet'], refunded: ['Refunded', 'quiet'], partially_refunded: ['Partly refunded', 'quiet'],
}

export default async function MyOrders() {
  const a = await requireMember('/orders')
  const [{ theme, brand, nav, account, site, bundle }, orders] = await Promise.all([
    getShell(),
    a.db.from('orders').select('id, order_no, status, total_minor, currency, placed_at, order_items(title_snapshot)').eq('member_id', a.memberId).order('placed_at', { ascending: false }).limit(100),
  ])
  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <section className="mx-auto max-w-[1000px] px-5 pb-20 pt-8 md:pt-10">
        <AccountNav bundle={bundle} active="orders" />
        <h1 className={h1s}>My orders</h1>
        {orders.data?.length ? (
          <ul className={`${ruleTop} mt-7`}>
            {orders.data.map((o) => {
              const [label, tone] = STATUS[o.status] ?? [o.status, 'quiet' as const]
              const unpaid = o.status === 'awaiting_payment'
              return (
                <li key={o.id} className="grid grid-cols-[1fr_auto] items-center gap-x-7 gap-y-1.5 border-b border-border py-[22px] sm:grid-cols-[1fr_auto_auto]">
                  <div>
                    <p className="text-[19px] font-semibold tracking-tight">{o.order_items.map((i) => i.title_snapshot).join(', ')}</p>
                    <p className="text-sm text-mute">{o.order_no} · {new Date(o.placed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <span className="text-lg font-semibold">{money(o.total_minor, o.currency)}</span>
                  <span className={`${chipClass(tone)} justify-self-start sm:justify-self-auto`}>{label}</span>
                  <Link href={unpaid ? `/checkout/${o.id}` : `/orders/${o.id}`}
                    className={unpaid
                      ? 'col-span-full mt-1 inline-flex h-11 items-center justify-self-start rounded-[10px] border-2 border-fg px-[18px] text-[15px] font-semibold'
                      : 'col-span-full justify-self-start text-base font-semibold text-primary'}>
                    {unpaid ? 'Pay now' : <>View receipt <span aria-hidden="true">→</span></>}
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : <p className="mt-8 text-lg text-grey">You have not bought anything yet.</p>}
      </section>
    </theme.SiteLayout>
  )
}
