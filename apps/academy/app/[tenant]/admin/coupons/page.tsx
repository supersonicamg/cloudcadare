import { requireAccess } from '@/lib/dal'
import { money } from '@/lib/money'
import { buttonQuiet } from '@/lib/ui'
import { setCouponActive } from './actions'
import { CouponCreateForm } from './form'

export const metadata = { title: 'Coupons' }

const isPast = (iso: string | null) => (iso ? new Date(iso).getTime() < Date.now() : false)

export default async function Coupons() {
  const a = await requireAccess({ permission: 'coupon.manage', feature: 'commerce.coupons' }, '/admin/coupons')
  const { data } = await a.db.from('coupons')
    .select('id, code, discount_type, discount_value, max_discount_minor, min_order_minor, max_redemptions, redeemed_count, per_member_limit, ends_at, is_active')
    .order('created_at', { ascending: false }).limit(200)

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Coupons</h1>
      <p className="mt-2 text-fg/70">Learners enter a code at checkout. A coupon never changes a price you set; it applies to one order.</p>

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-semibold">New coupon</h2>
        <CouponCreateForm />
      </section>

      <section className="mt-12">
        <h2 className="mb-4 text-xl font-semibold">Your coupons</h2>
        {data?.length ? (
          <ul className="border-t border-border">
            {data.map((c) => {
              const expired = isPast(c.ends_at)
              const off = c.discount_type === 'percent' ? `${Number(c.discount_value)}% off` : `${money(Math.round(Number(c.discount_value) * 100))} off`
              return (
                <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-border py-3">
                  <div>
                    <p className="font-medium"><span data-testid="coupon-code">{c.code}</span> <span className="font-normal text-fg/65">{off}</span></p>
                    <p className="text-sm text-fg/65">
                      Used {c.redeemed_count}{c.max_redemptions ? ` of ${c.max_redemptions}` : ''} · {c.per_member_limit} per learner
                      {c.max_discount_minor ? ` · up to ${money(c.max_discount_minor)}` : ''}{c.min_order_minor ? ` · from ${money(c.min_order_minor)}` : ''}
                      {c.ends_at ? ` · ${expired ? 'ended' : 'until'} ${new Date(c.ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                    </p>
                  </div>
                  <form action={setCouponActive.bind(null, c.id, !c.is_active)} className="flex items-center gap-3">
                    <span className="text-sm text-fg/65">{c.is_active ? (expired ? 'Expired' : 'Active') : 'Off'}</span>
                    <button className={buttonQuiet}>{c.is_active ? 'Turn off' : 'Turn on'}</button>
                  </form>
                </li>
              )
            })}
          </ul>
        ) : <p className="text-fg/70">No coupons yet.</p>}
      </section>
    </>
  )
}
