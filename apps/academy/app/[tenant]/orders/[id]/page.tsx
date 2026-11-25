import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { requireMember } from '@/lib/dal'
import { money } from '@/lib/money'
import { Icon } from '@educore/ui/marks'
import { getShell } from '@/lib/shell'
import { LearnerShell } from '../../_components/learner-shell'
import { backLink, h1s, ruleTop } from '@/lib/ui'
import { PrintButton } from './print-button'

export const metadata = { title: 'Receipt' }

interface Line { title: string; amount_minor: number; tax_minor?: number }

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
  const date = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <LearnerShell a={a} shell={shell} active={null}>
      <section className="max-w-[720px]">
        <p className="mb-8 print:hidden"><Link href="/account/payments" className={backLink}><Icon name="back" />Payments and receipts</Link></p>
        {receipt ? (
          <article aria-label="Receipt">
            <header className="flex flex-wrap items-baseline justify-between gap-4 border-b-2 border-fg pb-5">
              <h1 className={h1s}>Receipt</h1>
              <p className="text-grey">{receipt.invoice_no} · {date(receipt.issued_at)}</p>
            </header>
            <dl className="mt-6 grid gap-6 text-[15px] sm:grid-cols-2">
              <div><dt className="text-mute">From</dt><dd className="font-medium">{seller.name}</dd></div>
              <div><dt className="text-mute">To</dt><dd className="font-medium">{buyer.name}</dd><dd className="text-grey">{buyer.email}</dd></div>
            </dl>
            <ul className={`${ruleTop} mt-8`}>
              {lines.map((l, i) => <li key={i} className="flex justify-between gap-4 border-b border-border py-3"><span>{l.title}</span><span>{money(l.amount_minor, cur)}</span></li>)}
            </ul>
            <dl className="mt-5 space-y-1.5 text-[15px]">
              {!!t.discount_minor && <div className="flex justify-between"><dt>Coupon{t.coupon ? ` ${t.coupon}` : ''}</dt><dd>&minus;{money(t.discount_minor, cur)}</dd></div>}
              {!!t.tax_minor && <div className="flex justify-between text-grey"><dt>Includes tax</dt><dd>{money(t.tax_minor, cur)}</dd></div>}
              <div className="flex justify-between border-t border-border pt-3 text-xl font-bold"><dt>Total paid</dt><dd>{money(t.total_minor ?? 0, cur)}</dd></div>
            </dl>
            {notes.map((n) => (
              <p key={n.id} className="mt-4 text-sm text-grey">Refund {n.invoice_no}: {money(Math.abs(((n.totals ?? {}) as { total_minor?: number }).total_minor ?? 0), cur)} on {date(n.issued_at)}</p>
            ))}
            <p className="mt-8 text-sm text-mute">This is a payment receipt, not a GST tax invoice.</p>
            <div className="mt-6 print:hidden"><PrintButton /></div>
          </article>
        ) : (
          <div><h1 className={h1s}>Order {order.data.order_no}</h1>
            <p className="mt-4 text-lg text-grey">This order has no receipt because it has not been paid.</p></div>
        )}
      </section>
    </LearnerShell>
  )
}
