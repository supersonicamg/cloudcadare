import Link from 'next/link'
import { requireMember } from '@/lib/dal'
import { dateLong, dateShort } from '@/lib/format'
import { money } from '@/lib/money'
import { getShell } from '@/lib/shell'
import { buttonLg, h1s, h2s, lead } from '@/lib/ui'
import { Note, Panel, StatusChip, type StatusTone } from '../../_components/parts'

export const metadata = { title: 'Payments and receipts' }

/*
 * C4 · Payments and receipts ("prove what I paid").
 * 1. One job: show each order and what was paid on it, with a receipt for every verified payment.
 * 2. One main action: none (a waiting or unpaid order gets one outline link, "Open" or "Pay now").
 * 3. Reading order: title -> one line of totals -> one block per order, newest first: order number and status,
 *    then its payments as ruled rows (date, method, amount, status). Amount is the heaviest figure in a row.
 */

const ORDER: Record<string, [StatusTone, string]> = {
  paid: ['ok', 'Paid in full'], awaiting_payment: ['wait', 'Not paid yet'], pending: ['wait', 'Not paid yet'],
  partially_paid: ['action', 'Part paid'], failed: ['action', 'Payment failed'], cancelled: ['quiet', 'Cancelled'],
  refunded: ['quiet', 'Refunded'], partially_refunded: ['quiet', 'Part refunded'],
}
const METHOD: Record<string, string> = { upi_manual: 'UPI QR', razorpay: 'Razorpay', cash: 'Cash', bank_transfer: 'Bank transfer', cheque: 'Cheque', card_pos: 'Card' }

function paymentStatus(p: { status: string; gateway: string }): [StatusTone, string] {
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
  const wa = brand.contact?.whatsapp?.replace(/\D/g, '')
  const waHref = wa && wa.length >= 8 ? `https://wa.me/${wa}?text=${encodeURIComponent('Hi, I have a question about a payment.')}` : null
  const list = orders.data ?? []
  const onList = (enrol.data?.length ?? 0) > 0

  if (list.length === 0) {
    return (
      <section aria-labelledby="pay-h" className="grid gap-6">
        <div className="grid gap-3">
          <h1 id="pay-h" className={h1s}>Payments and receipts</h1>
          <p className={lead}>{onList ? 'There is nothing to pay.' : 'You have not paid for anything yet.'}</p>
        </div>
        <Panel className="grid gap-5">
          {onList ? (
            <Note icon="check">
              You are on the CloudCadre learner list, so your course was added for you.{' '}
              {waHref && <>If you paid us before, <a href={waHref} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-4">message us on WhatsApp</a>.</>}
            </Note>
          ) : (
            <>
              <p className="t-body !text-fg">When you buy a course, each payment and its receipt will be listed here.</p>
              <div><Link href="/courses" className={buttonLg}>Join the next batch</Link></div>
            </>
          )}
        </Panel>
      </section>
    )
  }

  const paid = list.reduce((sum, o) => sum + (o.payments ?? []).filter((p) => p.status === 'captured').reduce((s, p) => s + p.amount_minor, 0), 0)

  return (
    <section aria-labelledby="pay-h" className="grid gap-8">
      <div className="grid gap-3">
        <h1 id="pay-h" className={h1s}>Payments and receipts</h1>
        <p className={lead}>{paid > 0 ? `You have paid ${money(paid)} so far.` : 'Nothing has been verified yet.'}</p>
      </div>

      {list.map((o) => {
        const [oTone, oWord] = ORDER[o.status] ?? (['quiet', o.status] as [StatusTone, string])
        const payments = [...(o.payments ?? [])].sort((x, y) => (x.paid_at ?? x.created_at).localeCompare(y.paid_at ?? y.created_at))
        const unpaid = o.status === 'awaiting_payment' || o.status === 'pending'
        return (
          <article key={o.id} aria-labelledby={`o-${o.id}`} className="grid gap-1 border-t-2 border-fg pt-4">
            <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
              <div className="grid gap-1">
                <h2 id={`o-${o.id}`} className={`${h2s} tnum`}>{o.order_no}</h2>
                <p className="t-label">{o.order_items.map((i) => i.title_snapshot).join(', ')} · placed {dateShort(o.placed_at)} · total <span className="tnum">{money(o.total_minor, o.currency)}</span></p>
              </div>
              <StatusChip tone={oTone}>{oWord}</StatusChip>
            </header>

            {payments.length > 0 ? (
              <ul className="mt-2">
                {payments.map((p) => {
                  const [tone, word] = paymentStatus(p)
                  const date = dateLong(p.paid_at ?? p.created_at)
                  return (
                    <li key={p.id} className="grid grid-cols-[1fr_auto] items-center gap-x-5 gap-y-1.5 border-b border-border py-3.5 sm:grid-cols-[112px_minmax(0,1fr)_104px_176px_80px]">
                      <span className="t-label tnum">{date}</span>
                      <span className="t-label order-last col-span-2 sm:order-none sm:col-span-1">{METHOD[p.gateway] ?? p.gateway}</span>
                      <span className="t-card tnum text-right">{money(p.amount_minor, o.currency)}</span>
                      <span className="justify-self-start sm:justify-self-auto"><StatusChip tone={tone}>{word}</StatusChip></span>
                      <span className="text-right">
                        {p.status === 'captured'
                          ? <Link href={`/orders/${o.id}`} className="t-label !text-primary hover:underline">Receipt</Link>
                          : p.gateway === 'upi_manual' && p.status === 'created' ? <Link href={`/checkout/${o.id}`} className="t-label !text-primary hover:underline">Open <span aria-hidden="true">→</span></Link> : null}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="t-body border-b border-border py-3.5">No payment yet.</p>
            )}
            {unpaid && <div className="pt-3"><Link href={`/checkout/${o.id}`} className="inline-flex min-h-11 items-center rounded-[10px] border-2 border-fg px-[18px] t-btn-sm hover:bg-muted">Pay now</Link></div>}
          </article>
        )
      })}
    </section>
  )
}
