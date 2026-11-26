import Link from 'next/link'
import { requireMember } from '@/lib/dal'
import { dateLong } from '@/lib/format'
import { money } from '@/lib/money'
import { getShell } from '@/lib/shell'
import { Ic } from '../../_components/v11'
import { waHref } from '../../_components/v11-bars'
import { St, type Tone } from '../ui'

export const metadata = { title: 'Payments and receipts' }

/*
 * Payments and receipts ("prove what I paid"): one block per order, newest first. Order number and total on top, status
 * in words beside it; its payments as ruled rows (date, method, amount, status, Receipt). No filled button: an unpaid
 * order gets one outline "Pay now" in its header.
 */

const ORDER: Record<string, [Tone, string]> = {
  paid: ['ok', 'Paid in full'], awaiting_payment: ['wait', 'Not paid yet'], pending: ['wait', 'Not paid yet'],
  partially_paid: ['action', 'Part paid'], failed: ['action', 'Payment failed'], cancelled: ['quiet', 'Cancelled · not paid'],
  refunded: ['quiet', 'Refunded'], partially_refunded: ['quiet', 'Part refunded'],
}
const METHOD: Record<string, string> = { upi_manual: 'UPI QR', razorpay: 'Razorpay', cash: 'Cash', bank_transfer: 'Bank transfer', cheque: 'Cheque', card_pos: 'Card' }

function paymentStatus(p: { status: string; gateway: string }): [Tone, string] {
  switch (p.status) {
    case 'captured': return ['ok', 'Verified']
    case 'refunded': case 'partially_refunded': return ['quiet', 'Refunded']
    case 'failed': return ['action', 'Needs action']
    default: return p.gateway === 'upi_manual' ? ['wait', 'Waiting for check'] : ['wait', 'Not completed']
  }
}

export default async function PaymentsPage() {
  const a = await requireMember('/account/payments')
  const [{ brand }, orders, enrol] = await Promise.all([
    getShell(),
    a.db.from('orders')
      .select('id, order_no, status, total_minor, currency, placed_at, order_items(title_snapshot), payments(id, gateway, amount_minor, status, paid_at, created_at)')
      .eq('member_id', a.memberId).order('placed_at', { ascending: false }).limit(50),
    a.db.from('enrollments').select('source').eq('member_id', a.memberId).eq('source', 'import').limit(1),
  ])
  const wa = waHref(brand, 'Hi, I have a question about a payment.')
  const list = orders.data ?? []
  const onList = (enrol.data?.length ?? 0) > 0

  if (list.length === 0) {
    return (
      <>
        <div className="pg-h"><div>
          <h1 className="t-title">Payments and receipts</h1>
          <p className="t-lead">{onList ? 'There is nothing to pay.' : 'You have not paid for anything yet.'}</p>
        </div></div>
        {onList ? (
          <p className="note-l"><Ic n="check" s /><span>
            You are on the {brand.name} learner list, so your course was added for you.{' '}
            {wa && <>If you paid us before, <a className="link link-s" href={wa} target="_blank" rel="noopener noreferrer" style={{ minHeight: 0 }}>message us on WhatsApp</a>.</>}
          </span></p>
        ) : (
          <div className="paper" style={{ padding: 'clamp(20px, 3cqi, 32px)', display: 'grid', gap: 16, justifyItems: 'start' }}>
            <p className="t-body">When you buy a course, each payment and its receipt will be listed here.</p>
            <Link href="/courses" className="btn">Join the next batch</Link>
          </div>
        )}
      </>
    )
  }

  const paid = list.reduce((sum, o) => sum + (o.payments ?? []).filter((p) => p.status === 'captured').reduce((s, p) => s + p.amount_minor, 0), 0)

  return (
    <>
      <div className="pg-h"><div>
        <h1 className="t-title">Payments and receipts</h1>
        <p className="t-lead">{paid > 0 ? <>You have paid <b>{money(paid)}</b> so far.</> : 'Nothing has been verified yet.'}</p>
      </div></div>

      {list.map((o) => {
        const [oTone, oWord] = ORDER[o.status] ?? (['quiet', o.status] as [Tone, string])
        const payments = [...(o.payments ?? [])].sort((x, y) => (x.paid_at ?? x.created_at).localeCompare(y.paid_at ?? y.created_at))
        const unpaid = o.status === 'awaiting_payment' || o.status === 'pending'
        const captured = payments.filter((p) => p.status === 'captured')
        const received = captured.reduce((s, p) => s + p.amount_minor, 0)
        return (
          <article key={o.id} className="order" aria-labelledby={`o-${o.id}`}>
            <header className="order-h">
              <div className="l">
                <h2 className="t-h3 tnum" id={`o-${o.id}`}>Order {o.order_no}</h2>
                <p className="t-small">{[o.order_items.map((i) => i.title_snapshot).join(', '), `placed ${dateLong(o.placed_at)}`].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="r">
                <span className="t-num tnum" style={oTone === 'quiet' ? { color: 'var(--muted)' } : undefined}>{money(o.total_minor, o.currency)}</span>
                <St tone={oTone}>{oWord}</St>
                {unpaid && <Link href={`/checkout/${o.id}`} className="btn btn-line btn-sm">Pay now</Link>}
              </div>
            </header>

            {payments.length > 0 ? (
              <ul>
                {payments.map((p) => {
                  const [tone, pw] = paymentStatus(p)
                  const open = p.gateway === 'upi_manual' && p.status === 'created'
                  return (
                    <li key={p.id} className="pay">
                      <span className="dt tnum">{dateLong(p.paid_at ?? p.created_at)}</span>
                      <span className="mt">{METHOD[p.gateway] ?? p.gateway}</span>
                      <span className="amt tnum">{money(p.amount_minor, o.currency)}</span>
                      <span className="stc"><St tone={tone}>{pw}</St></span>
                      {p.status === 'captured' ? <Link className="link" href={`/orders/${o.id}`}>Receipt</Link>
                        : open ? <Link className="link" href={`/checkout/${o.id}`}>Open</Link> : <span />}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="t-small" style={{ padding: '12px 0', borderBottom: '1px solid var(--rule)' }}>
                {oTone === 'quiet' ? 'No payment was made on this order.' : 'No payment yet.'}
              </p>
            )}
            {o.status === 'partially_paid' && (
              <p className="note-l" style={{ marginTop: 14 }}><Ic n="info" s /><span>{money(received, o.currency)} of {money(o.total_minor, o.currency)} is paid. {money(Math.max(0, o.total_minor - received), o.currency)} is still to pay.</span></p>
            )}
            {captured.length > 1 && o.status === 'paid' && (
              <p className="note-l" style={{ marginTop: 14 }}><Ic n="info" s /><span>This order was paid in {captured.length} payments. They are all on this one order.</span></p>
            )}
          </article>
        )
      })}

      {wa && <p className="t-small" style={{ marginTop: 28 }}>A question about a payment? <a className="link link-s" href={wa} target="_blank" rel="noopener noreferrer">Ask on WhatsApp</a></p>}
    </>
  )
}
