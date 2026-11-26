import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { loadGateway } from '@educore/core/commerce'
import { readUpiSettings, upiPayLink, upiQrSvg, whatsappScreenshotLink } from '@educore/core/commerce/upi'
import { isEnabled } from '@educore/features'
import { FAKE_KEYS, hmacHex } from '@educore/integrations/payments'
import { requireMember } from '@/lib/dal'
import { emailCodeRequired } from '@/lib/email-code'
import { money } from '@/lib/money'
import { paymentsOff } from '@/lib/online-payments'
import { getShell } from '@/lib/shell'
import { Dg, Ic, V11Frame, Wa } from '../../_components/v11'
import { CheckoutBar } from '../../_components/v11-bars'
import { completeFree } from '../actions'
import { CouponForm } from '../coupon-form'
import { submitUpiPayment } from '../upi-actions'
import { CopyRow } from './copy-row'
import { LockedPayments } from './locked-payments'
import { MethodPicker, type Method } from './method-picker'
import { PayButton } from './pay-button'
import '../../login/auth.css'
import '../checkout.css'

export const metadata = { title: 'Checkout' }

/*
 * Checkout (UPI live, Razorpay "coming soon").
 * 1. One job: pay the exact amount and tell us it is done.
 * 2. One main action: "I have paid" (the only filled button; on phones it sticks to the bottom of the screen).
 * 3. Reading order: "Pay ₹49,999" -> method list (UPI chosen, Razorpay greyed) -> the QR panel (dominant: the biggest
 *    block, on paper) with three numbered steps -> UPI ID and note to copy -> "I have paid". The order summary sits
 *    beside it as facts, with the total as the one big number.
 *
 * Online payment switched off (lib/online-payments): the job is "enter your coupon code". "Apply code" is the one filled
 * button; the payment methods sit under it as locked rows. No real UPI ID or QR reaches the page.
 */
export default async function Checkout({ params }: PageProps<'/[tenant]/checkout/[orderId]'>) {
  const { orderId } = await params
  if (!z.uuid().safeParse(orderId).success) notFound()
  const a = await requireMember(`/checkout/${orderId}`)
  const [{ brand, site }, order, items, gwPay, payments, proof, settings, { data: me }, codeRequired] = await Promise.all([
    getShell(),
    a.db.from('orders').select('id, order_no, status, total_minor, subtotal_minor, tax_minor, discount_minor, coupon_id, currency').eq('id', orderId).eq('member_id', a.memberId).maybeSingle(),
    a.db.from('order_items').select('title_snapshot').eq('order_id', orderId),
    a.db.from('payments').select('gateway_order_id, failure_reason').eq('order_id', orderId).eq('status', 'created').neq('gateway', 'upi_manual').not('gateway_order_id', 'is', null).limit(1).maybeSingle(),
    a.db.from('payments').select('amount_minor, status').eq('order_id', orderId),
    a.db.from('payment_proofs').select('state').eq('order_id', orderId).eq('state', 'pending_review').maybeSingle(),
    a.db.from('tenant_settings').select('commerce').eq('tenant_id', a.bundle.tenant.id).maybeSingle(),
    a.db.from('tenant_members').select('email_verified_at').eq('id', a.memberId).single(),
    emailCodeRequired(a.db, a.bundle.tenant.id),
  ])
  if (!order.data) notFound()
  const o = order.data
  if (o.status === 'paid') redirect(`/checkout/${orderId}/done`)
  const paused = paymentsOff(settings.data?.commerce)
  if (proof.data && !paused) redirect(`/checkout/${orderId}/pending`)
  // Nothing is sold to an address nobody has proven (the same rule the database applies to "I have paid").
  if (codeRequired && !me?.email_verified_at) redirect(`/signup/confirm?next=${encodeURIComponent(`/checkout/${orderId}`)}`)

  const title = items.data?.map((i) => i.title_snapshot).join(', ') ?? 'Your order'
  const paid = (payments.data ?? []).filter((p) => p.status === 'captured').reduce((s, p) => s + p.amount_minor, 0)
  const balance = o.total_minor - paid
  const upi = readUpiSettings((settings.data?.commerce as { upi?: unknown } | null)?.upi)
  const gw = !paused && gwPay.data?.gateway_order_id ? await loadGateway(a.bundle.tenant.id) : null
  const open = o.status === 'awaiting_payment' || o.status === 'partially_paid'
  const free = o.status === 'awaiting_payment' && o.total_minor === 0
  const razorpayReady = Boolean(open && !free && gw && gwPay.data?.gateway_order_id)
  const couponsOn = isEnabled(a.bundle.features, 'commerce.coupons') && o.status === 'awaiting_payment' && paid === 0
  const wa = whatsappScreenshotLink(upi.whatsappNumber || brand.contact?.whatsapp || '', o.order_no, undefined)
  // With payment off the UPI settings are not real yet, so their WhatsApp number is not offered either.
  const help = (brand.contact?.whatsapp ?? (paused ? '' : upi.whatsappNumber)).replace(/\D/g, '')
  const helpText = paused ? `Hi, I need a coupon code for order ${o.order_no}.` : `Hi, I need help paying for order ${o.order_no}.`
  const helpHref = help.length >= 8 ? `https://wa.me/${help}?text=${encodeURIComponent(helpText)}` : null
  const refunds = site?.legal?.find((l) => /refund/i.test(l.label))

  let fake: { paymentId: string; signature: string } | undefined
  if (razorpayReady && gw?.mode === 'fake') {
    const paymentId = `pay_fake_${o.order_no.replace(/\W/g, '')}`
    fake = { paymentId, signature: hmacHex(FAKE_KEYS.secret, `${gwPay.data!.gateway_order_id}|${paymentId}`) }
  }

  // ---- The UPI panel: the QR for exactly what is still due, on the server.
  const upiOn = !paused && open && !free && upi.enabled && balance > 0
  const link = upiOn ? upiPayLink({ vpa: upi.vpa, payeeName: upi.payeeName || brand.name, amountMinor: balance, note: o.order_no }) : null
  const qr = link ? await upiQrSvg(link) : null
  const due = money(balance, o.currency)
  const upiPanel = link && qr && (
    <>
      <section aria-labelledby="qr-h" className="upi">
        <h2 id="qr-h" className="sr">Pay with the QR code</h2>
        <div className="qr">
          {/* The SVG is drawn by our own code from a link we built: no user input reaches the markup. */}
          <div role="img" aria-label={`QR code to pay ${due} to ${upi.vpa}`} dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="t-label tnum">{due} is filled in for you</p>
          {/* On a phone the learner cannot scan their own screen: the same link opens their UPI app. */}
          <a className="btn btn-line btn-sm upi-app" href={link}>Open UPI app</a>
        </div>
        <ol className="steps">
          <li><span className="n" aria-hidden="true">1</span><span className="t-body"><b>Scan the code</b> with any UPI app.</span></li>
          <li><span className="n" aria-hidden="true">2</span><span className="t-body"><b className="tnum">Pay {due}.</b> Do not change the amount or the note.</span></li>
          <li><span className="n" aria-hidden="true">3</span><span className="t-body"><b>Take a screenshot</b> of the success screen. You send it next.</span></li>
        </ol>
      </section>
      <dl className="copies">
        <CopyRow label="UPI ID" value={upi.vpa} />
        <CopyRow label="Note" value={o.order_no} tnum />
      </dl>
      <form action={submitUpiPayment.bind(null, o.id)} className="form-act pay-act">
        <button className="btn">I have paid</button>
        <span className="t-label">Next, you send us the screenshot.</span>
      </form>
    </>
  )

  const methods: Method[] = []
  if (upiOn && upiPanel) methods.push({ id: 'upi', title: 'UPI QR code', sub: 'GPay, PhonePe, Paytm or any UPI app', panel: upiPanel })
  if (razorpayReady) {
    methods.push({
      id: 'razorpay', title: 'Card, net banking, wallets', sub: 'Pay online with Razorpay',
      panel: <PayButton orderId={o.id} gatewayOrderId={gwPay.data!.gateway_order_id!} keyId={gw!.keyId} amountMinor={o.total_minor} currency={o.currency}
        amountLabel={money(o.total_minor, o.currency)} academy={brand.name} description={title} prefill={{ name: a.memberName, email: '' }} fake={fake} />,
    })
  } else if (!paused && open && !free && upi.razorpayComingSoon) {
    methods.push({ id: 'razorpay', title: 'Card, net banking, wallets', sub: 'Pay online with Razorpay', soon: true, panel: null })
  }
  const initial = methods.find((m) => !m.soon)?.id ?? ''
  const couponOnly = paused && open && !free

  return (
    <V11Frame shell="focus" header={<CheckoutBar brand={brand} middle="secure" exit={{ href: '/courses', label: 'Leave checkout' }} />}>
      <div className="co">
        <div className="co-main">
          <div>
            <p className="t-label tnum">Order {o.order_no}</p>
            <h1 className="t-title" style={{ marginTop: 4 }}>{free ? 'Your order is free' : couponOnly ? 'Join with a coupon code' : `Pay ${money(balance > 0 ? balance : o.total_minor, o.currency)}`}</h1>
            <p className="t-lead" style={{ marginTop: 8 }}>
              {couponOnly ? 'Online payment is switched off for now. Enter the code we gave you.'
                : paid > 0 ? `You have paid ${money(paid, o.currency)}. This is the rest.` : free ? 'The coupon covers the whole price. Enrol to start.' : 'Pay by UPI, then tell us it is done. We open your course as soon as we see the payment.'}
            </p>
          </div>

          {free ? (
            <form action={completeFree.bind(null, o.id)} className="form-act"><button className="btn">Enrol for free</button></form>
          ) : couponOnly ? (
            <>
              {couponsOn ? (
                <>
                  {o.coupon_id && <p role="status" className="note-l"><Ic n="info" /><span>This code does not cover the full price. Remove it and enter the code we gave you.</span></p>}
                  <CouponForm orderId={o.id} applied={Boolean(o.coupon_id)} main />
                </>
              ) : (
                <p className="note-l"><Ic n="info" /><span>A coupon cannot be added to this order. Please contact us.</span></p>
              )}
              <LockedPayments />
            </>
          ) : methods.length > 0 ? (
            <>
              <MethodPicker methods={methods} initial={initial} />
              {gwPay.data?.failure_reason && razorpayReady && (
                <p role="alert" className="ferr"><Ic n="info" s />Your last card payment did not go through: {gwPay.data.failure_reason} You can try again.</p>
              )}
            </>
          ) : (
            <div className="stack">
              <p className="note-l"><Ic n="info" /><span>{open ? 'Online payment is not set up yet, so we will take your payment on WhatsApp.' : 'This order can no longer be paid.'}</span></p>
              {open && helpHref && <div className="form-act"><a href={helpHref} target="_blank" rel="noopener noreferrer" className="btn">Message us to pay</a></div>}
            </div>
          )}
          {wa === null && upiOn && <p className="t-small">The academy has not added a WhatsApp number for screenshots yet. You will be able to upload it on the next page.</p>}
        </div>

        <aside className="osum" aria-label="Order summary">
          <div className="prod">
            <Dg id="dg1" label={false} />
            <span><b className="t-card">{title}</b></span>
          </div>
          {(o.tax_minor > 0 || o.discount_minor > 0 || paid > 0) && (
            <dl>
              {o.discount_minor > 0 && <div><dt>Coupon discount</dt><dd className="tnum" data-testid="order-discount">&minus;{money(o.discount_minor, o.currency)}</dd></div>}
              {o.tax_minor > 0 && <div><dt>{o.discount_minor > 0 ? 'Fee after coupon' : 'Fee'}</dt><dd className="tnum">{money(o.subtotal_minor, o.currency)}</dd></div>}
              {o.tax_minor > 0 && <div><dt>GST</dt><dd className="tnum">{money(o.tax_minor, o.currency)}</dd></div>}
              {paid > 0 && <div><dt>Paid so far</dt><dd className="tnum">{money(paid, o.currency)}</dd></div>}
            </dl>
          )}
          <p className="tot">
            <span className="t-small"><b>{paid > 0 ? 'Balance' : 'Total'}</b></span>
            <span className="t-num tnum" data-testid="order-total">{money(paid > 0 ? balance : o.total_minor, o.currency)}</span>
          </p>
          {couponsOn && !couponOnly && <CouponForm orderId={o.id} applied={Boolean(o.coupon_id)} />}
          {(helpHref || refunds) && (
            <div className="help">
              <span className="t-label">{couponOnly ? 'Need a code?' : 'Stuck, or need a code?'}</span>
              {helpHref && <a className="link link-s" href={helpHref} target="_blank" rel="noopener noreferrer"><Wa />Ask on WhatsApp</a>}
              {refunds && <a className="t-label" href={refunds.href}>Refund policy</a>}
            </div>
          )}
        </aside>
      </div>
    </V11Frame>
  )
}
