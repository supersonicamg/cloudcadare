import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { REJECT_REASON_TEXT, readUpiSettings, whatsappScreenshotLink } from '@educore/core/commerce/upi'
import { Icon } from '@educore/ui/marks'
import { requireMember } from '@/lib/dal'
import { dateShort, nowMs, timeShort } from '@/lib/format'
import { money } from '@/lib/money'
import { getShell } from '@/lib/shell'
import { buttonLg, h1s, lead } from '@/lib/ui'
import { Panel } from '../../../_components/parts'
import { submitUpiPayment } from '../../upi-actions'
import { ProofUpload } from './proof-upload'
import { Watcher } from './watcher'

export const metadata = { title: 'Your payment' }

/*
 * A6 · Waiting for verification, and A8 · Could not match (same URL, the state decides).
 * 1. One job: A6 get the screenshot to us. A8 say what was wrong and how to fix it.
 * 2. One main action: A6 "Send screenshot on WhatsApp" (filled; the upload is a folded, quieter option).
 *    A8 one filled button that matches the reason ("Pay the remaining ₹9,999" or "Send the screenshot again").
 * 3. Reading order: outcome as the title -> where we are in four steps (a quiet list; the current step is bold) ->
 *    the action card (dominant) -> what we will check (facts, secondary, stone).
 */

function when(iso: string) {
  const day = (d: string | number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(d))
  return `${day(iso) === day(nowMs()) ? 'Today' : dateShort(iso)}, ${timeShort(iso)}`
}

function Steps({ items }: { items: Array<{ title: string; detail: string; state: 'done' | 'now' | 'next' }> }) {
  return (
    <ol className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4" aria-label="Where your payment is">
      {items.map((s, i) => (
        <li key={s.title} aria-current={s.state === 'now' ? 'step' : undefined}
          className={`grid content-start gap-1 p-4 ${s.state === 'now' ? 'bg-fg text-white' : s.state === 'done' ? 'bg-white' : 'bg-muted'}`}>
          <span className="flex items-center justify-between">
            <span className={`t-num !text-2xl ${s.state === 'now' ? '!text-accent' : s.state === 'done' ? '!text-primary' : '!text-mute'}`}>{String(i + 1).padStart(2, '0')}</span>
            {s.state === 'done' && <Icon name="check" className="h-5 w-5 text-primary" />}
          </span>
          <b className={`t-label ${s.state === 'now' ? '!text-white' : s.state === 'next' ? '!text-grey' : '!text-fg'} font-bold`}>{s.title}</b>
          <span className={`t-small ${s.state === 'now' ? '!text-white/80' : ''}`}>{s.detail}</span>
        </li>
      ))}
    </ol>
  )
}

export default async function Pending({ params }: PageProps<'/[tenant]/checkout/[orderId]/pending'>) {
  const { orderId } = await params
  if (!z.uuid().safeParse(orderId).success) notFound()
  const a = await requireMember(`/checkout/${orderId}/pending`)
  const [{ theme, brand }, order, proofs, settings, items] = await Promise.all([
    getShell(),
    a.db.from('orders').select('id, order_no, status, total_minor, currency, placed_at').eq('id', orderId).eq('member_id', a.memberId).maybeSingle(),
    a.db.from('payment_proofs').select('id, state, source, file_path, utr, amount_minor, reject_reason, reject_note, submitted_at').eq('order_id', orderId).order('submitted_at', { ascending: false }).limit(1),
    a.db.from('tenant_settings').select('commerce').eq('tenant_id', a.bundle.tenant.id).maybeSingle(),
    a.db.from('order_items').select('title_snapshot').eq('order_id', orderId),
  ])
  if (!order.data) notFound()
  const o = order.data
  const proof = proofs.data?.[0]
  if (o.status === 'paid') redirect(`/checkout/${orderId}/done`)
  if (!proof) redirect(`/checkout/${orderId}`)

  const upi = readUpiSettings((settings.data?.commerce as { upi?: unknown } | null)?.upi)
  const title = items.data?.map((i) => i.title_snapshot).join(', ') ?? 'your course'
  const amount = money(proof.amount_minor, o.currency)
  const wa = whatsappScreenshotLink(upi.whatsappNumber || brand.contact?.whatsapp || '', o.order_no, undefined)
  const waNumber = upi.whatsappNumber || brand.contact?.whatsapp || ''
  const help = (brand.contact?.whatsapp ?? upi.whatsappNumber).replace(/\D/g, '')
  const helpHref = help.length >= 8 ? `https://wa.me/${help}?text=${encodeURIComponent(`Hi, I need help with order ${o.order_no}.`)}` : null
  const bar = { title: 'Your payment', exit: { label: 'Close', href: '/account/payments' } }
  const key = `${o.status}:${proof.state}`

  // ---------------------------------------------------------------- A8: could not match
  if (proof.state === 'rejected') {
    const reason = proof.reject_reason ?? 'not_received'
    const still = o.total_minor - 0
    const short = reason === 'amount_mismatch'
    // The balance still due is read fresh: part of the order may already be paid.
    const { data: paidRows } = await a.db.from('payments').select('amount_minor, status').eq('order_id', orderId)
    const paid = (paidRows ?? []).filter((p) => p.status === 'captured').reduce((s, p) => s + p.amount_minor, 0)
    const balance = Math.max(0, still - paid)
    const main = short && balance > 0
      ? { label: `Pay the remaining ${money(balance, o.currency)}`, href: `/checkout/${orderId}` }
      : reason === 'wrong_account' ? { label: 'See the right UPI ID', href: `/checkout/${orderId}` } : null
    return (
      <theme.FocusLayout brand={brand} bar={bar}>
        <Watcher orderId={orderId} shown={key} />
        <section aria-labelledby="rj-h" className="mx-auto grid max-w-[720px] gap-6 px-[clamp(16px,5vw,32px)] pb-24 pt-10 md:pt-16">
          <div className="grid gap-3">
            <p className="t-label tnum">Order {o.order_no}</p>
            <h1 id="rj-h" className={h1s}>We could not match your payment</h1>
            <p className={lead}>{REJECT_REASON_TEXT[reason] ?? REJECT_REASON_TEXT.not_received}{short && balance > 0 ? ` ${money(balance, o.currency)} is still due.` : ''}</p>
          </div>
          {proof.reject_note && (
            <p className="t-body flex items-start gap-3 rounded-2xl bg-muted p-4 !text-fg">
              <Icon name="info" className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span><b className="font-bold">From our team:</b> {proof.reject_note}</span>
            </p>
          )}
          <div className="grid gap-4">
            {main ? (
              <Link href={main.href} className={`${buttonLg} w-full sm:w-fit`}>{main.label} <span aria-hidden="true">→</span></Link>
            ) : (
              <form action={submitUpiPayment.bind(null, orderId)}><button className={`${buttonLg} w-full sm:w-fit`}>Send the screenshot again <span aria-hidden="true">→</span></button></form>
            )}
            {helpHref && <p className="t-small">Not sure what went wrong? <a href={helpHref} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-4">Message us on WhatsApp</a>.</p>}
          </div>
        </section>
      </theme.FocusLayout>
    )
  }

  // ---------------------------------------------------------------- A6: waiting
  const within = upi.slaText ? upi.slaText.charAt(0).toUpperCase() + upi.slaText.slice(1) : 'We check as soon as we can'
  return (
    <theme.FocusLayout brand={brand} bar={bar}>
      <Watcher orderId={orderId} shown={key} />
      <div className="mx-auto grid max-w-[1000px] gap-8 px-[clamp(16px,5vw,32px)] pb-24 pt-10 md:pt-14">
        <div className="grid gap-3">
          <p className="t-label tnum">Order {o.order_no}</p>
          <h1 className={h1s}>Thank you. We are checking your payment.</h1>
        </div>
        <Steps items={[
          { title: 'Order placed', detail: when(o.placed_at), state: 'done' },
          { title: 'You paid by UPI', detail: amount, state: 'done' },
          { title: 'We check it', detail: within, state: 'now' },
          { title: `${title} unlocked`, detail: 'You get an email', state: 'next' },
        ]} />

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-labelledby="send-h" className="grid gap-5 rounded-[24px] border-2 border-fg p-5 sm:p-7">
            <div className="grid gap-2">
              <h2 id="send-h" className="t-section">{proof.source === 'upload' ? 'We have your screenshot' : 'Send us the payment screenshot'}</h2>
              <p className="t-body">
                {proof.source === 'upload'
                  ? 'We will check it and unlock your course. You can also send it on WhatsApp.'
                  : 'Message it to our WhatsApp number with your order number. We unlock your course as soon as we see the payment.'}
              </p>
            </div>
            {wa ? (
              <div className="grid gap-2">
                <a href={wa} target="_blank" rel="noopener noreferrer" className={`${buttonLg} w-full sm:w-fit`}>
                  <svg className="h-6 w-6 fill-white" viewBox="0 0 24 24" aria-hidden="true"><use href="#lg-whatsapp" /></svg>Send screenshot on WhatsApp
                </a>
                <p className="t-small">WhatsApp number: <b className="font-semibold text-fg tnum">{waNumber}</b>. Opens with your order number already typed.</p>
              </div>
            ) : (
              <p className="t-body rounded-2xl bg-muted p-4 !text-fg">Upload your screenshot below. The academy has not added a WhatsApp number yet.</p>
            )}
            <ProofUpload orderId={orderId} hasFile={Boolean(proof.file_path)} utr={proof.utr} open={!wa} />
          </section>

          <aside aria-labelledby="chk-h">
            <Panel className="grid gap-3">
              <h2 id="chk-h" className="t-card">What we will check</h2>
              <dl className="grid gap-2">
                {[['Amount', amount], ['Paid to', upi.vpa || 'our UPI ID'], ['Note', o.order_no]].map(([k, v]) => (
                  <div key={k} className="flex flex-wrap items-baseline gap-x-2"><dt className="t-label">{k}</dt><dd className="t-label tnum !text-fg font-bold break-all">{v}</dd></div>
                ))}
              </dl>
              {upi.hoursText && <p className="t-small border-t border-border pt-3">We check payments {upi.hoursText}.</p>}
              <p className="t-small">While you wait, <Link href="/courses" className="font-semibold text-primary underline underline-offset-4">look at the free lessons</Link>.</p>
            </Panel>
          </aside>
        </div>
      </div>
    </theme.FocusLayout>
  )
}
