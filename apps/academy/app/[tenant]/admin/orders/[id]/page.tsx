import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { can, holds, requireAccess } from '@/lib/dal'
import { money } from '@/lib/money'
import { RefundForm } from '../refund-form'
import { sectionTitle } from '@/lib/ui'

export const metadata = { title: 'Order' }

const STATUS: Record<string, string> = { pending: 'Pending', awaiting_payment: 'Awaiting payment', paid: 'Paid', partially_paid: 'Partly paid', failed: 'Failed', cancelled: 'Cancelled', refunded: 'Refunded', partially_refunded: 'Partly refunded' }
const when = (d: string | null) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

export default async function OrderDetail({ params }: PageProps<'/[tenant]/admin/orders/[id]'>) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const a = await requireAccess({ permission: 'order.view', feature: 'commerce.checkout' }, `/admin/orders/${id}`)

  const { data: o } = await a.db.from('orders')
    .select('id, order_no, status, total_minor, subtotal_minor, discount_minor, tax_minor, currency, placed_at, paid_at, coupon_id, tenant_members(display_name, email), order_items(title_snapshot, total_minor)')
    .eq('id', id).maybeSingle()
  if (!o) notFound()
  const [pays, refunds, docs] = await Promise.all([
    a.db.from('payments').select('id, gateway, gateway_payment_id, amount_minor, status, method, paid_at, failure_reason').eq('order_id', id).order('created_at'),
    a.db.from('refunds').select('id, payment_id, amount_minor, status, reason, processed_at, created_at').in('payment_id', (await a.db.from('payments').select('id').eq('order_id', id)).data?.map((p) => p.id) ?? []).order('created_at'),
    a.db.from('invoices').select('id, kind, invoice_no, issued_at').eq('order_id', id).order('issued_at'),
  ])
  const m = Array.isArray(o.tenant_members) ? o.tenant_members[0] : o.tenant_members
  const captured = pays.data?.find((p) => p.status === 'captured' || p.status === 'partially_refunded')
  const taken = (refunds.data ?? []).filter((r) => r.status === 'pending' || r.status === 'processed').reduce((n, r) => n + r.amount_minor, 0)
  const left = captured ? captured.amount_minor - taken : 0
  const refundable = (o.status === 'paid' || o.status === 'partially_refunded') && left > 0

  return (
    <>
      <Link href="/admin/orders" className="text-sm text-mute hover:text-fg">&larr; Orders</Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Order {o.order_no}</h1>
      <p className="mt-1 text-grey">{m?.display_name} · {m?.email} · placed {when(o.placed_at)}</p>

      <section className="mt-8 border-t border-border pt-5">
        <ul className="space-y-1">
          {o.order_items.map((i, n) => <li key={n} className="flex justify-between gap-4"><span>{i.title_snapshot}</span><span>{money(i.total_minor, o.currency)}</span></li>)}
        </ul>
        <dl className="mt-4 space-y-1 text-[15px]">
          {o.discount_minor > 0 && <div className="flex justify-between"><dt>Coupon discount</dt><dd>&minus;{money(o.discount_minor, o.currency)}</dd></div>}
          {o.tax_minor > 0 && <div className="flex justify-between text-grey"><dt>Includes tax</dt><dd>{money(o.tax_minor, o.currency)}</dd></div>}
          <div className="flex justify-between text-lg font-semibold"><dt>Total</dt><dd data-testid="order-total">{money(o.total_minor, o.currency)}</dd></div>
          <div className="flex justify-between"><dt>Status</dt><dd data-testid="order-status">{STATUS[o.status] ?? o.status}</dd></div>
        </dl>
      </section>

      {!!pays.data?.length && (
        <section className="mt-10">
          <h2 className="mb-3 text-xl font-semibold">Payments</h2>
          <ul className="border-t border-border">
            {pays.data.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-x-6 border-b border-border py-2.5 text-[15px]">
                <span>{p.gateway_payment_id ?? 'Waiting for payment'} <span className="text-mute">{p.method ?? ''}</span></span>
                <span>{money(p.amount_minor, o.currency)} · {p.status.replace('_', ' ')}{p.failure_reason ? ` (${p.failure_reason})` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!refunds.data?.length && (
        <section className="mt-10">
          <h2 className="mb-3 text-xl font-semibold">Refunds</h2>
          <ul className="border-t border-border">
            {refunds.data.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-x-6 border-b border-border py-2.5 text-[15px]">
                <span>{r.reason ?? 'No reason given'} <span className="text-mute">{when(r.processed_at ?? r.created_at)}</span></span>
                <span data-testid="refund-row">{money(r.amount_minor, o.currency)} · {r.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!docs.data?.length && (
        <p className="mt-8 text-sm text-grey">{docs.data.map((d) => `${d.kind.replace('_', ' ')} ${d.invoice_no}`).join(' · ')}</p>
      )}

      {refundable && (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className={sectionTitle + " mb-4"}>Refund</h2>
          {can(a, 'refund.manage') ? (
            <RefundForm orderId={o.id} left={money(left, o.currency)} />
          ) : holds(a, 'refund.manage') ? (
            <p><Link href={`/admin/mfa?next=${encodeURIComponent(`/admin/orders/${o.id}`)}`} className="text-primary underline">Verify your authenticator code</Link> to issue refunds.</p>
          ) : <p className="text-grey">You do not have permission to issue refunds.</p>}
        </section>
      )}
    </>
  )
}
