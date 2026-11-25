import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { loadGateway } from '@educore/core/commerce'
import { readUpiSettings, upiPayLink, upiQrSvg, whatsappScreenshotLink } from '@educore/core/commerce/upi'
import { isEnabled } from '@educore/features'
import { FAKE_KEYS, hmacHex } from '@educore/integrations/payments'
import { Icon, Logo, platformFor } from '@educore/ui/marks'
import { requireMember } from '@/lib/dal'
import { money } from '@/lib/money'
import { getShell } from '@/lib/shell'
import { buttonLg, h1s, lead } from '@/lib/ui'
import { completeFree } from '../actions'
import { CouponForm } from '../coupon-form'
import { submitUpiPayment } from '../upi-actions'
import { CopyRow } from './copy-row'
import { MethodPicker, type Method } from './method-picker'
import { PayButton } from './pay-button'

export const metadata = { title: 'Checkout' }

/*
 * A5 · Checkout (UPI live, Razorpay "coming soon").
 * 1. One job: pay the exact amount and tell us it is done.
 * 2. One main action: "I have paid" (the only filled button; on phones it is pinned to the bottom of the screen).
 * 3. Reading order: "Pay ₹49,999" -> method list (UPI chosen, Razorpay greyed) -> the QR panel (dominant: the biggest
 *    block, on stone) with three numbered steps -> UPI ID and note to copy -> "I have paid". The order summary sits
 *    beside it on desktop and is secondary (smaller, no fill): the total is the one big numeral.
 */
export default async function Checkout({ params }: PageProps<'/[tenant]/checkout/[orderId]'>) {
  const { orderId } = await params
  if (!z.uuid().safeParse(orderId).success) notFound()
  const a = await requireMember(`/checkout/${orderId}`)
  const [{ theme, brand, site }, order, items, gwPay, payments, proof, settings, { data: me }] = await Promise.all([
    getShell(),
    a.db.from('orders').select('id, order_no, status, total_minor, tax_minor, discount_minor, coupon_id, currency').eq('id', orderId).eq('member_id', a.memberId).maybeSingle(),
    a.db.from('order_items').select('title_snapshot').eq('order_id', orderId),
    a.db.from('payments').select('gateway_order_id, failure_reason').eq('order_id', orderId).eq('status', 'created').neq('gateway', 'upi_manual').not('gateway_order_id', 'is', null).limit(1).maybeSingle(),
    a.db.from('payments').select('amount_minor, status').eq('order_id', orderId),
    a.db.from('payment_proofs').select('state').eq('order_id', orderId).eq('state', 'pending_review').maybeSingle(),
    a.db.from('tenant_settings').select('commerce').eq('tenant_id', a.bundle.tenant.id).maybeSingle(),
    a.db.from('tenant_members').select('email_verified_at').eq('id', a.memberId).single(),
  ])
  if (!order.data) notFound()
  const o = order.data
  if (o.status === 'paid') redirect(`/checkout/${orderId}/done`)
  if (proof.data) redirect(`/checkout/${orderId}/pending`)
  // Nothing is sold to an address nobody has proven (the same rule the database applies to "I have paid").
  if (!me?.email_verified_at) redirect(`/signup/confirm?next=${encodeURIComponent(`/checkout/${orderId}`)}`)

  const title = items.data?.map((i) => i.title_snapshot).join(', ') ?? 'Your order'
  const paid = (payments.data ?? []).filter((p) => p.status === 'captured').reduce((s, p) => s + p.amount_minor, 0)
  const balance = o.total_minor - paid
  const upi = readUpiSettings((settings.data?.commerce as { upi?: unknown } | null)?.upi)
  const gw = gwPay.data?.gateway_order_id ? await loadGateway(a.bundle.tenant.id) : null
  const open = o.status === 'awaiting_payment' || o.status === 'partially_paid'
  const free = o.status === 'awaiting_payment' && o.total_minor === 0
  const razorpayReady = Boolean(open && !free && gw && gwPay.data?.gateway_order_id)
  const couponsOn = isEnabled(a.bundle.features, 'commerce.coupons') && o.status === 'awaiting_payment' && paid === 0
  const logo = platformFor(title)
  const wa = whatsappScreenshotLink(upi.whatsappNumber || brand.contact?.whatsapp || '', o.order_no, undefined)
  const help = (brand.contact?.whatsapp ?? upi.whatsappNumber).replace(/\D/g, '')
  const helpHref = help.length >= 8 ? `https://wa.me/${help}?text=${encodeURIComponent(`Hi, I need help paying for order ${o.order_no}.`)}` : null
  const refunds = site?.legal?.find((l) => /refund/i.test(l.label))

  let fake: { paymentId: string; signature: string } | undefined
  if (razorpayReady && gw?.mode === 'fake') {
    const paymentId = `pay_fake_${o.order_no.replace(/\W/g, '')}`
    fake = { paymentId, signature: hmacHex(FAKE_KEYS.secret, `${gwPay.data!.gateway_order_id}|${paymentId}`) }
  }

  // ---- The UPI panel: the QR for exactly what is still due, on the server.
  const upiOn = open && !free && upi.enabled && balance > 0
  const link = upiOn ? upiPayLink({ vpa: upi.vpa, payeeName: upi.payeeName || brand.name, amountMinor: balance, note: o.order_no }) : null
  const qr = link ? await upiQrSvg(link) : null
  const upiPanel = link && qr && (
    <div className="grid gap-5">
      <section aria-labelledby="qr-h" className="grid gap-6 rounded-[clamp(22px,2.6vw,32px)] bg-muted p-5 sm:p-7 md:grid-cols-[236px_minmax(0,1fr)] md:items-center">
        <div className="grid justify-items-center gap-2 md:justify-items-start">
          {/* The SVG is drawn by our own code from a link we built: no user input reaches the markup. */}
          <div role="img" aria-label={`QR code to pay ${money(balance, o.currency)} to ${upi.vpa}`} className="w-[212px] rounded-2xl bg-white p-3 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="t-small tnum text-center md:text-left">{money(balance, o.currency)} is filled in for you</p>
        </div>
        <div className="grid gap-4">
          <h2 id="qr-h" className="sr-only">Pay with the QR code</h2>
          <ol className="grid gap-3.5">
            {[
              [<><b className="font-bold text-fg">Scan the code</b> with any UPI app.</>],
              [<><b className="font-bold text-fg tnum">Pay {money(balance, o.currency)}.</b> Do not change the amount or the note.</>],
              [<><b className="font-bold text-fg">Take a screenshot</b> of the success screen. You send it next.</>],
            ].map(([text], i) => (
              <li key={i} className="t-body flex items-start gap-3.5">
                <span aria-hidden="true" className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-fg t-label !text-white tnum">{i + 1}</span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
          {/* On a phone the learner cannot scan their own screen: the same link opens their UPI app. */}
          <a href={link} className="inline-flex min-h-11 w-fit items-center rounded-[10px] border-2 border-fg px-[18px] t-btn-sm hover:bg-white md:hidden">Open UPI app</a>
        </div>
      </section>
      <div className="grid gap-2.5">
        <CopyRow label="UPI ID" value={upi.vpa} />
        <CopyRow label="Note" value={o.order_no} />
      </div>
      {/* Pinned to the bottom edge on phones so the one action never scrolls away. */}
      <form action={submitUpiPayment.bind(null, o.id)}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg px-5 py-3 md:static md:z-auto md:border-0 md:bg-transparent md:p-0">
        <button className={`${buttonLg} w-full sm:w-auto`}>I have paid <span aria-hidden="true">→</span></button>
      </form>
    </div>
  )

  const methods: Method[] = []
  if (upiOn && upiPanel) methods.push({ id: 'upi', title: 'UPI QR code', sub: 'Scan with GPay, PhonePe, Paytm or any UPI app', panel: upiPanel })
  if (razorpayReady) {
    methods.push({
      id: 'razorpay', title: 'Card, net banking, wallets', sub: 'Pay online with Razorpay',
      panel: <PayButton orderId={o.id} gatewayOrderId={gwPay.data!.gateway_order_id!} keyId={gw!.keyId} amountMinor={o.total_minor} currency={o.currency}
        amountLabel={money(o.total_minor, o.currency)} academy={brand.name} description={title} prefill={{ name: a.memberName, email: '' }} fake={fake} />,
    })
  } else if (open && !free && upi.razorpayComingSoon) {
    methods.push({ id: 'razorpay', title: 'Card, net banking, wallets', sub: 'Pay online with Razorpay', soon: true, panel: null })
  }
  const initial = methods.find((m) => !m.soon)?.id ?? ''

  return (
    <theme.FocusLayout brand={brand} bar={{ title: 'Checkout', note: 'Secure checkout', exit: { label: 'Leave checkout', href: '/courses' } }}>
      <div className="mx-auto grid max-w-[1180px] items-start gap-10 px-[clamp(16px,5vw,72px)] pb-28 pt-8 md:pb-20 md:pt-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
        <div className="grid min-w-0 gap-6">
          <div className="grid gap-3">
            <h1 className={h1s}>{free ? 'Your order is free' : `Pay ${money(balance > 0 ? balance : o.total_minor, o.currency)}`}</h1>
            <p className={lead}>
              {paid > 0 ? `You have paid ${money(paid, o.currency)}. This is the rest.` : free ? 'The coupon covers the whole price. Enrol to start.' : 'Pay by UPI, then tell us it is done. We unlock your course once we see the payment.'}
            </p>
          </div>

          {free ? (
            <form action={completeFree.bind(null, o.id)}><button className={`${buttonLg} w-full sm:w-auto`}>Enrol for free</button></form>
          ) : methods.length > 0 ? (
            <>
              <MethodPicker methods={methods} initial={initial} />
              {gwPay.data?.failure_reason && razorpayReady && (
                <p role="alert" className="t-label flex items-start gap-2 !text-fg"><Icon name="info" className="mt-px h-5 w-5 shrink-0 text-primary" />Your last card payment did not go through: {gwPay.data.failure_reason} You can try again.</p>
              )}
            </>
          ) : (
            <div className="grid gap-4 rounded-2xl bg-muted p-5">
              <p className="t-body !text-fg">{open ? 'Online payment is not set up yet, so we will take your payment on WhatsApp.' : 'This order can no longer be paid.'}</p>
              {open && helpHref && <a href={helpHref} target="_blank" rel="noopener noreferrer" className={`${buttonLg} w-fit`}>Message us to pay</a>}
            </div>
          )}

          {helpHref && !free && (
            <p className="t-small flex items-center gap-2.5">
              <svg className="h-5 w-5 fill-[#25D366]" viewBox="0 0 24 24" aria-hidden="true"><use href="#lg-whatsapp" /></svg>
              <span>Payment stuck? <a href={helpHref} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-4">Message us on WhatsApp</a></span>
            </p>
          )}
          {wa === null && upiOn && <p className="t-small">The academy has not added a WhatsApp number for screenshots yet. You will be able to upload it on the next page.</p>}
        </div>

        <aside aria-labelledby="sum-h" className="grid gap-4 lg:sticky lg:top-8">
          <h2 id="sum-h" className="sr-only">Order summary</h2>
          <div className="grid gap-4 rounded-[24px] border border-border p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-muted">
                {logo ? <Logo name={logo} className="h-9 w-9" /> : <Icon name="book" className="h-7 w-7" />}
              </span>
              <div className="min-w-0"><p className="t-card">{title}</p><p className="t-small tnum">Order {o.order_no}</p></div>
            </div>
            <div className="grid gap-1.5 border-t border-border pt-4">
              {o.discount_minor > 0 && <p className="t-label flex items-baseline justify-between"><span>Coupon discount</span><span className="tnum !text-deep" data-testid="order-discount">&minus;{money(o.discount_minor, o.currency)}</span></p>}
              {paid > 0 && <p className="t-label flex items-baseline justify-between"><span>Paid so far</span><span className="tnum">{money(paid, o.currency)}</span></p>}
              <p className="flex items-baseline justify-between gap-4"><span className="t-label !text-fg">{paid > 0 ? 'Balance' : 'Total'}</span><span className="t-num !text-fg" data-testid="order-total">{money(paid > 0 ? balance : o.total_minor, o.currency)}</span></p>
              {o.tax_minor > 0 && <p className="t-small text-right tnum">Includes {money(o.tax_minor, o.currency)} GST</p>}
            </div>
          </div>
          {couponsOn && <CouponForm orderId={o.id} applied={Boolean(o.coupon_id)} />}
          {refunds && <p className="t-small flex items-start gap-2"><Icon name="shield" className="mt-px h-5 w-5 shrink-0 text-primary" /><span>Questions about refunds? Read the <a href={refunds.href} className="font-semibold text-primary underline underline-offset-4">refund policy</a>.</span></p>}
        </aside>
      </div>
    </theme.FocusLayout>
  )
}
