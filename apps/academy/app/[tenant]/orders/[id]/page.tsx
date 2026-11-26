import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { requireMember } from '@/lib/dal'
import { dateLong } from '@/lib/format'
import { money } from '@/lib/money'
import { getShell } from '@/lib/shell'
import { LearnerShell } from '../../_components/learner-shell'
import { Ic } from '../../_components/v11'
import '../../account/account.css'
import { PrintButton } from './print-button'

export const metadata = { title: 'Receipt' }

interface Line { title: string; amount_minor: number; tax_minor?: number }

/** The payment receipt, printable. Not in the mockup: the same v11 parts (ruled lines, facts), no new look. */
export default async function Receipt({ params }: PageProps<'/[tenant]/orders/[id]'>) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const a = await requireMember(`/orders/${id}`)
  const [shell, order, docs] = await Promise.all([
    getShell(),
    a.db.from('orders').select('id, order_no, status, paid_at, placed_at').eq('id', id).eq('member_id', a.memberId).maybeSingle(),
    a.db.from('invoices').select('id, kind, invoice_no, issued_at, seller, buyer, lines, totals').eq('order_id', id).order('issued_at'),
  ])
  if (!order.data) notFound()
  const receipt = docs.data?.find((d) => d.kind === 'receipt')
  const notes = docs.data?.filter((d) => d.kind === 'credit_note') ?? []
  const t = (receipt?.totals ?? {}) as { subtotal_minor?: number; discount_minor?: number; tax_minor?: number; total_minor?: number; currency?: string; coupon?: string | null }
  const cur = t.currency ?? 'INR'
  const lines = (receipt?.lines ?? []) as unknown as Line[]
  const seller = (receipt?.seller ?? {}) as { name?: string }
  const buyer = (receipt?.buyer ?? {}) as { name?: string; email?: string }

  return (
    <LearnerShell a={a} shell={shell} active={null}>
      <div className="pg">
        <p className="noprint" style={{ marginBottom: 24 }}><Link href="/account/payments" className="fback"><Ic n="back" />Payments and receipts</Link></p>
        {receipt ? (
          <article className="rcp" aria-label="Receipt">
            <header className="rcp-h">
              <h1 className="t-title">Receipt</h1>
              <p className="t-small tnum">{receipt.invoice_no} · {dateLong(receipt.issued_at)}</p>
            </header>
            <dl className="rcp-parties">
              <div><dt className="t-label">From</dt><dd>{seller.name}</dd></div>
              <div><dt className="t-label">To</dt><dd>{buyer.name}</dd><dd className="t-small" style={{ fontWeight: 400 }}>{buyer.email}</dd></div>
            </dl>
            <ul className="rcp-lines">
              {lines.map((l, i) => <li key={i}><span>{l.title}</span><span className="tnum">{money(l.amount_minor, cur)}</span></li>)}
            </ul>
            <dl className="rcp-sum">
              {!!t.discount_minor && <div><dt>Coupon{t.coupon ? ` ${t.coupon}` : ''}</dt><dd className="tnum">&minus;{money(t.discount_minor, cur)}</dd></div>}
              {!!t.tax_minor && <div><dt className="t-small">Includes tax</dt><dd className="tnum" style={{ fontWeight: 400 }}>{money(t.tax_minor, cur)}</dd></div>}
              <div className="tot"><dt>Total paid</dt><dd className="tnum">{money(t.total_minor ?? 0, cur)}</dd></div>
            </dl>
            {notes.map((n) => (
              <p key={n.id} className="t-small" style={{ marginTop: 16 }}>Refund {n.invoice_no}: {money(Math.abs(((n.totals ?? {}) as { total_minor?: number }).total_minor ?? 0), cur)} on {dateLong(n.issued_at)}</p>
            ))}
            <p className="t-label" style={{ marginTop: 32 }}>This is a payment receipt, not a GST tax invoice.</p>
            <p className="noprint" style={{ marginTop: 24 }}><PrintButton /></p>
          </article>
        ) : (
          <div className="rcp">
            <h1 className="t-title">Order {order.data.order_no}</h1>
            <p className="t-lead" style={{ marginTop: 8 }}>This order has no receipt because it has not been paid.</p>
          </div>
        )}
      </div>
    </LearnerShell>
  )
}
