import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { REJECT_REASON_TEXT, readUpiSettings, whatsappScreenshotLink } from '@educore/core/commerce/upi'
import { requireMember } from '@/lib/dal'
import { money } from '@/lib/money'
import { paymentsOff } from '@/lib/online-payments'
import { getShell } from '@/lib/shell'
import { Ic, V11Frame, Wa } from '../../../_components/v11'
import { CheckoutBar } from '../../../_components/v11-bars'
import { submitUpiPayment } from '../../upi-actions'
import { ProofUpload } from './proof-upload'
import { Watcher } from './watcher'
import '../../../login/auth.css'
import '../../checkout.css'

export const metadata = { title: 'Your payment' }

/*
 * Waiting for verification, and Could not match (same URL, the state decides).
 * 1. One job: waiting: get the screenshot to us. Could not match: say what was wrong and how to fix it.
 * 2. One main action: waiting: "Send screenshot on WhatsApp" (filled; the upload is a folded, quieter option).
 *    Could not match: one filled button that matches the reason ("Pay the remaining ₹9,999" or "Send the screenshot again").
 * 3. Reading order: outcome as the title -> where we are in four steps (the current step is the ink cell) ->
 *    the action block (dominant) -> what we will check (facts, secondary, beside it).
 */

type Step = { title: string; state: 'done' | 'now' | 'later' }

function Track({ steps }: { steps: Step[] }) {
  return (
    <ol className="track" aria-label="Where your payment is">
      {steps.map((s, i) => {
        const word = s.state === 'done' ? 'Done' : s.state === 'now' ? 'Now' : steps.slice(0, i).some((p) => p.state === 'later') ? 'Then' : 'Next'
        return (
          <li key={s.title} className={s.state === 'done' ? undefined : s.state} aria-current={s.state === 'now' ? 'step' : undefined}>
            <span className="n">{s.state === 'done' && <Ic n="check" s />}{word}</span>
            <b>{s.title}</b>
          </li>
        )
      })}
    </ol>
  )
}

export default async function Pending({ params }: PageProps<'/[tenant]/checkout/[orderId]/pending'>) {
  const { orderId } = await params
  if (!z.uuid().safeParse(orderId).success) notFound()
  const a = await requireMember(`/checkout/${orderId}/pending`)
  const [{ brand }, order, proofs, settings] = await Promise.all([
    getShell(),
    a.db.from('orders').select('id, order_no, status, total_minor, currency').eq('id', orderId).eq('member_id', a.memberId).maybeSingle(),
    a.db.from('payment_proofs').select('id, state, source, file_path, utr, amount_minor, reject_reason, reject_note, submitted_at').eq('order_id', orderId).order('submitted_at', { ascending: false }).limit(1),
    a.db.from('tenant_settings').select('commerce').eq('tenant_id', a.bundle.tenant.id).maybeSingle(),
  ])
  if (!order.data) notFound()
  const o = order.data
  const proof = proofs.data?.[0]
  if (o.status === 'paid') redirect(`/checkout/${orderId}/done`)
  if (!proof || paymentsOff(settings.data?.commerce)) redirect(`/checkout/${orderId}`)

  const upi = readUpiSettings((settings.data?.commerce as { upi?: unknown } | null)?.upi)
  const amount = money(proof.amount_minor, o.currency)
  const wa = whatsappScreenshotLink(upi.whatsappNumber || brand.contact?.whatsapp || '', o.order_no, undefined)
  const waNumber = upi.whatsappNumber || brand.contact?.whatsapp || ''
  const help = (brand.contact?.whatsapp ?? upi.whatsappNumber).replace(/\D/g, '')
  const helpHref = help.length >= 8 ? `https://wa.me/${help}?text=${encodeURIComponent(`Hi, I need help with order ${o.order_no}.`)}` : null
  const key = `${o.status}:${proof.state}`
  const bar = <CheckoutBar brand={brand} middle="Your payment" exit={{ href: '/account/payments', label: 'Close' }} />

  // ---------------------------------------------------------------- could not match
  if (proof.state === 'rejected') {
    const reason = proof.reject_reason ?? 'not_received'
    const short = reason === 'amount_mismatch'
    // The balance still due is read fresh: part of the order may already be paid.
    const { data: paidRows } = await a.db.from('payments').select('amount_minor, status').eq('order_id', orderId)
    const paid = (paidRows ?? []).filter((p) => p.status === 'captured').reduce((s, p) => s + p.amount_minor, 0)
    const balance = Math.max(0, o.total_minor - paid)
    const main = short && balance > 0
      ? { label: `Pay the remaining ${money(balance, o.currency)}`, href: `/checkout/${orderId}` }
      : reason === 'wrong_account' ? { label: 'See the right UPI ID', href: `/checkout/${orderId}` } : null
    return (
      <V11Frame shell="focus" header={bar}>
        <Watcher orderId={orderId} shown={key} />
        <div className="pst">
          <div className="pst-main">
            <div>
              <p className="t-label tnum">Order {o.order_no}</p>
              <h1 className="t-title" style={{ marginTop: 4 }}>We could not match your payment</h1>
              <p className="t-lead" style={{ marginTop: 8 }}>
                {REJECT_REASON_TEXT[reason] ?? REJECT_REASON_TEXT.not_received}{short && balance > 0 ? <> <b className="tnum">{money(balance, o.currency)} is still due.</b></> : ''}
              </p>
            </div>
            {proof.reject_note && <blockquote className="quote"><b>From our team:</b> {proof.reject_note}</blockquote>}
            <div className="form-act">
              {main ? (
                <Link href={main.href} className="btn">{main.label}</Link>
              ) : (
                <form action={submitUpiPayment.bind(null, orderId)}><button className="btn">Send the screenshot again</button></form>
              )}
              {helpHref && <a className="link" href={helpHref} target="_blank" rel="noopener noreferrer"><Wa />Ask on WhatsApp</a>}
            </div>
            {paid > 0 && <p className="t-small tnum">The {money(paid, o.currency)} is saved on this order. You do not pay it again.</p>}
          </div>
          <aside>
            <h2 className="t-card" style={{ marginBottom: 10 }}>This order</h2>
            <dl className="chkl">
              <div><dt>Total</dt><dd className="tnum">{money(o.total_minor, o.currency)}</dd></div>
              {paid > 0 && <div><dt>Paid and verified</dt><dd className="tnum">{money(paid, o.currency)}</dd></div>}
              <div><dt>Still due</dt><dd className="tnum">{money(balance, o.currency)}</dd></div>
            </dl>
          </aside>
        </div>
      </V11Frame>
    )
  }

  // ---------------------------------------------------------------- waiting
  // The screenshot counts as sent once something was uploaded here; one sent on WhatsApp cannot be seen from here.
  const sent = proof.source === 'upload' || Boolean(proof.file_path) || Boolean(proof.utr)
  const hours = upi.hoursText ? `We check payments ${upi.hoursText}.` : ''
  const sla = upi.slaText ? `${upi.slaText.charAt(0).toUpperCase()}${upi.slaText.slice(1)}.` : ''
  const lead = [hours, sla].filter(Boolean).join(' ') || 'We check as soon as we can.'
  return (
    <V11Frame shell="focus" header={bar}>
      <Watcher orderId={orderId} shown={key} />
      <div className="pst">
        <div className="pst-main">
          <div>
            <p className="t-label tnum">Order {o.order_no} · {amount}</p>
            <h1 className="t-title" style={{ marginTop: 4 }}>Thank you. We are checking your payment.</h1>
            <p className="t-lead" style={{ marginTop: 8 }}>{lead}</p>
          </div>
          <Track steps={[
            { title: 'You paid by UPI', state: 'done' },
            { title: 'Send us the screenshot', state: sent ? 'done' : 'now' },
            { title: 'We check it', state: sent ? 'now' : 'later' },
            { title: 'Your course opens', state: 'later' },
          ]} />

          <section className="send" aria-labelledby="send-h">
            <h2 className="t-h3" id="send-h">{sent ? 'We have your screenshot' : 'Send us the payment screenshot'}</h2>
            <p className="t-small">
              {sent
                ? 'We will check it and open your course. You can also send it on WhatsApp.'
                : wa ? 'WhatsApp opens with your order number already typed. Attach the screenshot and press send.' : 'The academy has not added a WhatsApp number yet, so upload your screenshot below.'}
            </p>
            {wa && (
              <div className="form-act" style={{ marginTop: 0 }}>
                <a className="btn" href={wa} target="_blank" rel="noopener noreferrer"><Wa />Send screenshot on WhatsApp</a>
                <span className="t-label">Our number: <b className="tnum">{waNumber}</b></span>
              </div>
            )}
            <ProofUpload orderId={orderId} hasFile={Boolean(proof.file_path)} utr={proof.utr} open={!wa} />
          </section>

          <p className="t-small">While you wait, <Link className="link link-s" href="/courses">look at the free lessons</Link>.</p>
        </div>
        <aside>
          <h2 className="t-card" style={{ marginBottom: 10 }}>What we check</h2>
          <dl className="chkl">
            <div><dt>Order</dt><dd className="tnum">{o.order_no}</dd></div>
            <div><dt>Amount</dt><dd className="tnum">{amount}</dd></div>
            <div><dt>Paid to</dt><dd>{upi.vpa || 'our UPI ID'}</dd></div>
            <div><dt>Note on the payment</dt><dd className="tnum">{o.order_no}</dd></div>
          </dl>
          <p className="t-label" style={{ marginTop: 12 }}>This page updates by itself when we are done.</p>
        </aside>
      </div>
    </V11Frame>
  )
}
