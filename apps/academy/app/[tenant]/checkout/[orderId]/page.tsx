import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { loadGateway } from '@educore/core/commerce'
import { isEnabled } from '@educore/features'
import { FAKE_KEYS, hmacHex } from '@educore/integrations/payments'
import { Icon, Logo, platformFor } from '@educore/ui/marks'
import { requireMember } from '@/lib/dal'
import { money } from '@/lib/money'
import { getShell } from '@/lib/shell'
import { backLink, bannerClass, buttonLg, h1s } from '@/lib/ui'
import { completeFree } from '../actions'
import { CouponForm } from '../coupon-form'
import { PayButton } from './pay-button'

export const metadata = { title: 'Checkout' }

export default async function Checkout({ params }: PageProps<'/[tenant]/checkout/[orderId]'>) {
  const { orderId } = await params
  if (!z.uuid().safeParse(orderId).success) notFound()
  const a = await requireMember(`/checkout/${orderId}`)
  const [{ theme, brand, nav, account, site }, order, items, pay] = await Promise.all([
    getShell(),
    a.db.from('orders').select('id, order_no, status, total_minor, tax_minor, discount_minor, coupon_id, currency').eq('id', orderId).eq('member_id', a.memberId).maybeSingle(),
    a.db.from('order_items').select('title_snapshot').eq('order_id', orderId),
    a.db.from('payments').select('gateway_order_id, failure_reason').eq('order_id', orderId).eq('status', 'created').not('gateway_order_id', 'is', null).limit(1).maybeSingle(),
  ])
  if (!order.data) notFound()
  if (order.data.status === 'paid') redirect('/learn')
  const o = order.data
  const title = items.data?.map((i) => i.title_snapshot).join(', ') ?? 'Your order'
  const gw = pay.data?.gateway_order_id ? await loadGateway(a.bundle.tenant.id) : null
  const free = o.status === 'awaiting_payment' && o.total_minor === 0
  const payable = !free && o.status === 'awaiting_payment' && gw && pay.data?.gateway_order_id
  const couponsOn = isEnabled(a.bundle.features, 'commerce.coupons') && o.status === 'awaiting_payment'
  const logo = platformFor(title)

  let fake: { paymentId: string; signature: string } | undefined
  if (payable && gw.mode === 'fake') {
    const paymentId = `pay_fake_${o.order_no.replace(/\W/g, '')}`
    fake = { paymentId, signature: hmacHex(FAKE_KEYS.secret, `${pay.data!.gateway_order_id}|${paymentId}`) }
  }

  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <section className="mx-auto flex max-w-[640px] flex-col gap-[26px] px-5 pb-20 pt-10 md:pt-16">
        <Link href="/courses" className={backLink}><Icon name="back" />Back to courses</Link>
        <h1 className={h1s}>Checkout</h1>
        {payable && pay.data?.failure_reason && (
          <p role="alert" className={bannerClass('bad')}>
            <Icon name="info" className="h-[22px] w-[22px] shrink-0" />
            <span>Your last payment attempt did not go through: {pay.data.failure_reason} You can try again.</span>
          </p>
        )}
        <div className="border-y-2 border-fg py-[22px]">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-tint-2">
              {logo ? <Logo name={logo} className="h-9 w-9" /> : <Icon name="book" className="h-7 w-7" />}
            </span>
            <div><p className="text-xl font-semibold tracking-tight">{title}</p><p className="text-sm text-mute">Order {o.order_no}</p></div>
          </div>
          <div className="mt-[22px]">
            {o.discount_minor > 0 && (
              <p className="mb-2.5 flex items-baseline justify-between text-[17px]"><span>Coupon discount</span><span className="font-semibold text-success" data-testid="order-discount">&minus;{money(o.discount_minor, o.currency)}</span></p>
            )}
            <p className="flex items-baseline justify-between gap-4 text-[17px] font-bold"><span>Total</span><span className="font-heading text-[34px] tracking-[-0.04em]" data-testid="order-total">{money(o.total_minor, o.currency)}</span></p>
            {o.tax_minor > 0 && <p className="mt-1 text-right text-sm text-mute">Includes {money(o.tax_minor, o.currency)} tax</p>}
          </div>
        </div>
        {couponsOn && <CouponForm orderId={o.id} applied={Boolean(o.coupon_id)} />}
        <div>
          {free ? (
            <form action={completeFree.bind(null, o.id)}><button className={`${buttonLg} w-full`}>Enrol for free</button></form>
          ) : payable ? (
            <PayButton orderId={o.id} gatewayOrderId={pay.data!.gateway_order_id!} keyId={gw.keyId} amountMinor={o.total_minor} currency={o.currency}
              amountLabel={money(o.total_minor, o.currency)} academy={brand.name} description={title} prefill={{ name: a.memberName, email: '' }} fake={fake} />
          ) : (
            <p className="rounded-2xl bg-muted px-4 py-3 text-[15px]">Online payment is not set up for this academy yet, so this order cannot be paid. Please contact the academy.</p>
          )}
          {payable && (
            <p className="mt-5 flex items-start gap-2.5 text-sm leading-snug text-mute">
              <Icon name="lock" className="mt-px h-[18px] w-[18px] shrink-0" />
              <span>You’ll pay on a secure payment page with UPI, card or netbanking. We never see your card details.</span>
            </p>
          )}
        </div>
      </section>
    </theme.SiteLayout>
  )
}
