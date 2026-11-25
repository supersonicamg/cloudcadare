import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { REJECT_REASON_TEXT } from '@educore/core/commerce/upi'
import { isEnabled } from '@educore/features'
import { can, holds, requireAccess, type Access } from '@/lib/dal'
import { dateShort, nowMs, timeShort } from '@/lib/format'
import { money } from '@/lib/money'
import { tenantOrigin } from '@/lib/outbox'
import { inputSm, pageLead, pageTitle, buttonOutline, td, th, tableWrap } from '@/lib/ui'
import { Icon } from '@educore/ui/marks'
import { Note, StatusChip } from '../../../_components/parts'
import { ReviewForm } from './review-form'

export const metadata = { title: 'UPI payments' }

/*
 * D1 · UPI payments queue.
 * 1. One job: turn a payment screenshot into access, safely. Nothing unlocks until staff approve.
 * 2. One main action: "Verify and unlock {course}" in the review panel (the only filled button).
 * 3. Reading order: title + one line -> text tabs with counts -> the queue, oldest first, with who, what, how long
 *    (dominant, left) -> the review panel (right): screenshot, automatic checks, the two ticks, the decision.
 *    The checks inform; they never decide. The ticks do: a screenshot can be faked, the money in the account cannot.
 */

const TABS = [['waiting', 'Waiting'], ['action', 'Needs action'], ['verified', 'Verified'], ['all', 'All']] as const
const OVERDUE_MS = 24 * 3600 * 1000
const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v) ?? null
const SELECT = 'id, state, source, file_path, utr, amount_minor, reject_reason, reject_note, whatsapp_seen, money_seen, reviewed_by, reviewed_at, submitted_at, order_id, orders(order_no, total_minor, currency, placed_at, status, order_items(title_snapshot)), tenant_members(display_name, email, phone)'

function waited(ms: number) {
  const min = Math.max(1, Math.floor(ms / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return h < 24 ? `${h} h ${min % 60 ? `${min % 60} min` : ''}`.trim() : `${h} h`
}
const when = (iso: string) => `${dateShort(iso)}, ${timeShort(iso)}`
/** A long program name on a button reads as its initials ("CloudCadre Elite Architect Program" -> "CEAP"). */
function shortTitle(t: string) {
  if (t.length <= 24) return t
  const abbr = t.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('')
  return abbr.length >= 2 && abbr.length <= 6 ? abbr : 'the course'
}
const initials =(name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')

export default async function UpiQueue(props: PageProps<'/[tenant]/admin/payments/upi'>) {
  const sp = await props.searchParams
  const tab = TABS.find(([k]) => k === sp.status)?.[0] ?? 'waiting'
  const q = (typeof sp.q === 'string' ? sp.q : '').trim().slice(0, 80).toLowerCase()
  const want = typeof sp.p === 'string' ? sp.p : ''

  // Holders of payment.verify may decide (this needs the two-step check, so the page asks for it); people who may only view orders can read.
  const probe = await requireAccess({ permission: 'member.view' }, '/admin/payments/upi')
  if (!isEnabled(probe.bundle.features, 'commerce.checkout')) notFound()
  let a: Access = probe
  if (holds(probe, 'payment.verify')) a = await requireAccess({ permission: 'payment.verify', feature: 'commerce.checkout' }, '/admin/payments/upi')
  else if (!can(probe, 'order.view')) notFound()
  const canVerify = can(a, 'payment.verify')

  const [waiting, recent] = await Promise.all([
    a.db.from('payment_proofs').select(SELECT).eq('state', 'pending_review').order('submitted_at', { ascending: true }).limit(200),
    a.db.from('payment_proofs').select(SELECT).neq('state', 'pending_review').neq('state', 'superseded').order('submitted_at', { ascending: false }).limit(200),
  ])
  type Row = NonNullable<typeof waiting.data>[number]
  const now = nowMs()
  const pendingOrders = new Set((waiting.data ?? []).map((r) => r.order_id))
  const seenOrders = new Set<string>()
  const needsAction = (recent.data ?? []).filter((r) => {
    // The latest decision on each order, and only while the order is still unpaid and nothing new is waiting.
    const latest = !seenOrders.has(r.order_id)
    seenOrders.add(r.order_id)
    const o = one(r.orders)
    return latest && r.state === 'rejected' && !pendingOrders.has(r.order_id) && (o?.status === 'awaiting_payment' || o?.status === 'partially_paid')
  })
  const verified = (recent.data ?? []).filter((r) => r.state === 'approved')
  const all = [...(waiting.data ?? []), ...(recent.data ?? [])].sort((x, y) => y.submitted_at.localeCompare(x.submitted_at))
  const lists = { waiting: waiting.data ?? [], action: needsAction, verified, all }
  const counts = { waiting: lists.waiting.length, action: needsAction.length, verified: verified.length, all: all.length }

  const match = (r: Row) => {
    if (!q) return true
    const m = one(r.tenant_members)
    const o = one(r.orders)
    return [o?.order_no, m?.display_name, m?.email, m?.phone].some((v) => v?.toLowerCase().includes(q))
  }
  const rows = lists[tab].filter(match)
  const selected = rows.find((r) => r.id === want) ?? all.find((r) => r.id === want) ?? rows[0] ?? null

  const href = (over: Record<string, string | null>) => {
    const p = new URLSearchParams()
    const base: Record<string, string | null> = { status: tab === 'waiting' ? null : tab, q: q || null, p: null, ...over }
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v)
    const s = p.toString()
    return `/admin/payments/upi${s ? `?${s}` : ''}`
  }

  // Everything the panel needs about the chosen payment.
  let panel: ReactNode = null
  if (selected) {
    const m = one(selected.tenant_members)
    const o = one(selected.orders)
    const course = o?.order_items.map((i) => i.title_snapshot).join(', ') || 'the course'
    const [{ data: pays }, reviewer] = await Promise.all([
      a.db.from('payments').select('amount_minor, status').eq('order_id', selected.order_id),
      selected.reviewed_by ? a.db.from('tenant_members').select('display_name').eq('id', selected.reviewed_by).maybeSingle() : Promise.resolve({ data: null }),
    ])
    const paidBefore = (pays ?? []).filter((p) => p.status === 'captured').reduce((s, p) => s + p.amount_minor, 0)
    // While waiting the proof's own payment is not captured yet, so the balance is total minus what was captured before.
    const due = selected.state === 'approved' ? selected.amount_minor : Math.max(0, (o?.total_minor ?? 0) - paidBefore)
    const cur = o?.currency ?? 'INR'
    const first = (m?.display_name ?? '').split(/\s+/)[0] || 'there'
    const base = tenantOrigin(a.bundle.tenant.slug)
    const message =
      selected.state === 'approved' ? `Hi ${first}, payment received. ${course} is unlocked: ${base}/learn`
      : selected.state === 'rejected' ? `Hi ${first}, we could not match your payment for order ${o?.order_no}. ${REJECT_REASON_TEXT[selected.reject_reason ?? ''] ?? ''}${selected.reject_note ? ` ${selected.reject_note}` : ''} What to do next: ${base}/checkout/${selected.order_id}/pending`
      : `Hi ${first}, we are checking your payment for order ${o?.order_no}. ${selected.source === 'whatsapp' ? 'If you have not sent the screenshot yet, please send it here.' : 'We have your screenshot.'}`
    const digits = (m?.phone ?? '').replace(/\D/g, '')
    const chatHref = digits.length >= 8 ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null
    const checks: Array<{ ok: boolean; label: string; value: string }> = [
      { ok: selected.amount_minor === due || selected.state !== 'pending_review', label: 'Amount', value: selected.amount_minor === due ? `${money(selected.amount_minor, cur)} equals the balance due` : `${money(selected.amount_minor, cur)} claimed, ${money(due, cur)} due` },
      { ok: true, label: 'Note', value: `Should read ${o?.order_no}` },
      { ok: Boolean(selected.utr), label: 'UPI reference', value: selected.utr ? `${selected.utr.replace(/(\d{4})(?=\d)/g, '$1 ')}, not used on another order` : 'Not given by the learner' },
      { ok: !o || new Date(selected.submitted_at) >= new Date(o.placed_at), label: 'Date', value: `Sent ${when(selected.submitted_at)}; order placed ${dateShort(o?.placed_at ?? selected.submitted_at)}` },
    ]
    const isPdf = selected.file_path?.toLowerCase().endsWith('.pdf')
    const proofUrl = `/api/payment-proof/${selected.id}`
    const stateChip =
      selected.state === 'approved' ? <StatusChip tone="ok">Verified</StatusChip>
      : selected.state === 'rejected' ? <StatusChip tone="action">Sent back</StatusChip>
      : <StatusChip tone="wait">Waiting</StatusChip>

    panel = (
      <aside id="review" aria-label="Review payment" className="grid content-start gap-4 rounded-[24px] border-2 border-fg bg-white p-5 xl:sticky xl:top-6">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-0.5">
            <h2 className="t-card">Review payment</h2>
            <p className="t-small tnum">{o?.order_no} · {course}</p>
          </div>
          {stateChip}
        </div>

        {selected.source === 'upload' && selected.file_path ? (
          <div className="grid gap-2">
            {isPdf ? (
              <a href={proofUrl} target="_blank" rel="noopener noreferrer" className={`${buttonOutline} w-full`}>Open the PDF the learner sent</a>
            ) : (
              <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl border border-border bg-muted">
                {/* A proof of payment sent by the learner: private, short-lived link behind a permission check. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={proofUrl} alt={`Payment screenshot from ${m?.display_name}`} className="mx-auto max-h-[420px] w-auto object-contain" />
              </a>
            )}
            <p className="t-small">Uploaded by the learner, {when(selected.submitted_at)}{!isPdf && <> · <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-4">Open full size</a></>}</p>
          </div>
        ) : (
          <Note icon="info">The learner sends the screenshot on WhatsApp{m?.phone ? <>, from <b className="tnum font-bold">{m.phone}</b></> : ''}. Find it there, then tick below.</Note>
        )}

        <ul aria-label="Automatic checks" className="grid border-t-2 border-fg">
          {checks.map((c) => (
            <li key={c.label} className="grid grid-cols-[20px_minmax(0,1fr)] items-start gap-x-3 border-b border-border py-2.5">
              <Icon name={c.ok ? 'check' : 'info'} className={`mt-0.5 h-5 w-5 ${c.ok ? 'text-primary' : 'text-mute'}`} />
              <span className="t-small !text-grey"><b className="font-bold !text-fg">{c.label}</b> · {c.value}</span>
            </li>
          ))}
        </ul>

        {selected.state !== 'pending_review' && (
          <p className="t-small">
            {selected.state === 'approved' ? 'Verified' : 'Sent back'} by {reviewer.data?.display_name ?? 'staff'}{selected.reviewed_at ? `, ${when(selected.reviewed_at)}` : ''}
            {selected.state === 'rejected' && selected.reject_reason ? `. ${REJECT_REASON_TEXT[selected.reject_reason] ?? ''}` : ''}
            {selected.reject_note ? ` Note: ${selected.reject_note}` : ''}
          </p>
        )}
        {selected.state === 'pending_review' && !canVerify && (
          <Note icon="lock">Verifying needs the two-step check. <Link href={`/admin/mfa?next=${encodeURIComponent('/admin/payments/upi')}`} className="font-semibold text-primary underline underline-offset-4">Verify your code</Link>, or ask someone who can verify payments.</Note>
        )}
        <ReviewForm
          key={selected.id}
          proofId={selected.id}
          source={selected.source as 'whatsapp' | 'upload'}
          courseTitle={shortTitle(course)}
          pending={selected.state === 'pending_review'}
          canVerify={canVerify}
          message={message}
          chatHref={chatHref}
        />
        {selected.state === 'pending_review' && canVerify && (
          <p className="t-small">Verifying enrols {m?.display_name} in {course}, marks the order paid and sends the receipt by email.</p>
        )}
      </aside>
    )
  }

  return (
    <>
      <div className="grid gap-2">
        <h1 className={pageTitle}>UPI payments</h1>
        <p className={pageLead}>Check each payment against the order, then unlock access. Nothing unlocks until you approve.</p>
      </div>

      <div className="mt-8 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-labelledby="q-h" className="min-w-0">
          <h2 id="q-h" className="sr-only">Payments</h2>
          <nav aria-label="Filter payments" className="flex flex-wrap gap-x-6 border-b border-border">
            {TABS.map(([k, label]) => (
              <Link key={k} href={href({ status: k === 'waiting' ? null : k })} aria-current={tab === k ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center gap-2 border-b-[3px] -mb-px t-label ${tab === k ? 'border-fg !text-fg font-bold' : 'border-transparent hover:!text-fg'}`}>
                {label} <span className="tnum font-normal text-mute">{counts[k]}</span>
              </Link>
            ))}
          </nav>
          <form action="/admin/payments/upi" className="flex flex-wrap items-center gap-3 py-4">
            {tab !== 'waiting' && <input type="hidden" name="status" value={tab} />}
            <label htmlFor="q" className="sr-only">Order, name, phone or email</label>
            <input id="q" name="q" type="search" defaultValue={q} placeholder="Order, name, phone or email" className={`${inputSm} max-w-sm`} />
            <button className={buttonOutline}>Search</button>
            <span className="t-small ml-auto">{tab === 'waiting' ? 'Oldest first' : 'Newest first'}</span>
          </form>

          {rows.length ? (
            <div className={tableWrap}>
              <table className="w-full text-[15px]">
                <thead className="border-t-2 border-fg">
                  <tr>
                    <th className={th}>Learner and order</th>
                    <th className={`${th} hidden md:table-cell`}>WhatsApp</th>
                    <th className={`${th} text-right`}>Amount</th>
                    <th className={`${th} hidden sm:table-cell`}>Proof</th>
                    <th className={th}>{tab === 'waiting' ? 'Waiting' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const m = one(r.tenant_members)
                    const o = one(r.orders)
                    const on = selected?.id === r.id
                    const wait = now - new Date(r.submitted_at).getTime()
                    return (
                      <tr key={r.id} className={on ? 'bg-muted' : ''}>
                        <td className={`${td} pl-3!`}>
                          <Link href={`${href({ p: r.id })}#review`} aria-current={on ? 'true' : undefined} className="flex items-center gap-3">
                            <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#E4EFEB] t-label !text-deep font-bold">{initials(m?.display_name ?? '?')}</span>
                            <span className="grid min-w-0">
                              <b className="truncate font-bold text-fg">{m?.display_name}</b>
                              <span className="t-small tnum">{o?.order_no}</span>
                            </span>
                          </Link>
                        </td>
                        <td className={`${td} t-label tnum hidden md:table-cell`}>{m?.phone ?? '—'}</td>
                        <td className={`${td} whitespace-nowrap text-right font-semibold tnum`}>{money(r.amount_minor, o?.currency ?? 'INR')}</td>
                        <td className={`${td} hidden sm:table-cell`}>{r.source === 'upload' ? <StatusChip tone="ok">Uploaded</StatusChip> : <StatusChip tone="quiet">WhatsApp</StatusChip>}</td>
                        <td className={td}>
                          {r.state === 'pending_review' ? (
                            wait > OVERDUE_MS ? <StatusChip tone="action">{waited(wait)} · Overdue</StatusChip> : <span className="t-label whitespace-nowrap !text-fg tnum">{waited(wait)}</span>
                          ) : r.state === 'approved' ? <StatusChip tone="ok">Verified</StatusChip> : <StatusChip tone="action">Sent back</StatusChip>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="border-t-2 border-fg pt-6 text-[17px] text-grey">
              {q ? 'No payment matches that search.' : tab === 'waiting' ? 'Nothing is waiting. New payments appear here when a learner presses “I have paid”.' : 'Nothing here yet.'}
            </p>
          )}
        </section>

        {panel}
      </div>
    </>
  )
}
