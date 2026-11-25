import { requireAccess } from '@/lib/dal'
import { money } from '@/lib/money'
import { buttonOutline, chipClass } from '@/lib/ui'
import { Card, Empty, PageHeader, Tabs } from '../_components/ui'
import { paymentPages, waitingPayments } from '../_components/sections'
import { setCouponActive } from './actions'
import { CouponCreateForm } from './form'

export const metadata = { title: 'Discount codes' }

const isPast = (iso: string | null) => (iso ? new Date(iso).getTime() < Date.now() : false)

export default async function Coupons() {
  const a = await requireAccess({ permission: 'coupon.manage', feature: 'commerce.coupons' }, '/admin/coupons')
  const { data } = await a.db.from('coupons')
    .select('id, code, discount_type, discount_value, max_discount_minor, min_order_minor, max_redemptions, redeemed_count, per_member_limit, ends_at, is_active')
    .order('created_at', { ascending: false }).limit(200)

  return (
    <>
      <PageHeader title="Payments" lead="A discount code lowers the price of one order when a student types it at checkout." />
      <Tabs label="Payments" current="/admin/coupons" items={paymentPages(a, await waitingPayments(a))} />

      <div className="grid gap-5">
        <Card title="Make a discount code"><CouponCreateForm /></Card>
        <Card title="Your codes">
          {data?.length ? (
            <ul className="divide-y divide-border border-y border-border">
              {data.map((c) => {
                const expired = isPast(c.ends_at)
                const off = c.discount_type === 'percent' ? `${Number(c.discount_value)}% off` : `${money(Math.round(Number(c.discount_value) * 100))} off`
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3.5">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="t-card break-all"><span data-testid="coupon-code">{c.code}</span> <span className="t-label">{off}</span></p>
                      <p className="t-small">
                        Used {c.redeemed_count}{c.max_redemptions ? ` of ${c.max_redemptions}` : ''} · {c.per_member_limit} per student
                        {c.max_discount_minor ? ` · up to ${money(c.max_discount_minor)}` : ''}{c.min_order_minor ? ` · on ${money(c.min_order_minor)} or more` : ''}
                        {c.ends_at ? ` · ${expired ? 'ended' : 'until'} ${new Date(c.ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                      </p>
                    </div>
                    <form action={setCouponActive.bind(null, c.id, !c.is_active)} className="flex items-center gap-3">
                      <span className={chipClass(c.is_active && !expired ? 'ok' : 'quiet')}>{c.is_active ? (expired ? 'Expired' : 'Working') : 'Off'}</span>
                      <button className={buttonOutline}>{c.is_active ? 'Turn off' : 'Turn on'}</button>
                    </form>
                  </li>
                )
              })}
            </ul>
          ) : <Empty title="No discount codes yet" />}
        </Card>
      </div>
    </>
  )
}
