import Link from 'next/link'
import { requireMember } from '@/lib/dal'
import { dateLong, daysUntil, nowMs } from '@/lib/format'
import { money } from '@/lib/money'
import { getShell } from '@/lib/shell'
import { Ic, Wa } from '../../_components/v11'
import { waHref } from '../../_components/v11-bars'
import { St, type Tone } from '../ui'

export const metadata = { title: 'Subscription' }

/*
 * Subscription ("do I have access, until when, and why?"): the answer is the first line, in one sentence.
 * The pass is the one dominant block: program, days left as the big number, a line from start to end with today on it,
 * and how access was given. No filled button while access runs; with no access, "Join the next batch" is the only one.
 */

const SOURCE: Record<string, string> = {
  admin: 'Added by CloudCadre staff.',
  import: 'Added by CloudCadre. Your email was on our learner list, so there was nothing to pay.',
  coupon: 'Joined with a coupon code.',
  free: 'Free enrolment.',
  trial: 'Free trial.',
  bundle: 'Part of a bundle.',
  subscription: 'Part of your subscription.',
}

const STATUS: Record<string, [Tone, string]> = {
  active: ['ok', 'Active'], paused: ['wait', 'Paused'], completed: ['ok', 'Completed'],
  expired: ['quiet', 'Ended'], cancelled: ['quiet', 'Cancelled'], refunded: ['quiet', 'Refunded'],
}

export default async function SubscriptionPage() {
  const a = await requireMember('/account/subscription')
  const [{ brand, site }, { data: rows }, unpaid] = await Promise.all([
    getShell(),
    a.db.from('enrollments')
      .select('id, source, status, started_at, expires_at, progress_pct, lessons_completed, lessons_total, courses(title, slug), order_item_id, batches(name, start_date)')
      .eq('member_id', a.memberId).order('started_at', { ascending: false }).limit(10),
    a.db.from('orders').select('id').eq('member_id', a.memberId).eq('status', 'awaiting_payment').order('placed_at', { ascending: false }).limit(1),
  ])
  // The live enrolment first (active, paused), else the newest one.
  const row = rows?.find((r) => r.status === 'active' || r.status === 'paused') ?? rows?.[0]
  const wa = waHref(brand, 'Hi, I have a question about my access.')
  const refunds = site?.legal?.find((l) => /refund/i.test(l.label))

  // ---- No access yet
  if (!row) {
    const unpaidId = unpaid.data?.[0]?.id
    return (
      <>
        <div className="pg-h"><div>
          <h1 className="t-title">Subscription</h1>
          <p className="t-lead">{unpaidId ? 'Your order is waiting for payment.' : 'You do not have access to a course yet.'}</p>
        </div></div>
        <div className="paper" style={{ padding: 'clamp(20px, 3cqi, 32px)', display: 'grid', gap: 16, justifyItems: 'start' }}>
          <p className="t-body">{unpaidId ? 'Pay to unlock the course. Your order is saved.' : 'Join the next batch to unlock the lessons, live classes and notes.'}</p>
          <Link href={unpaidId ? `/checkout/${unpaidId}` : '/courses'} className="btn">{unpaidId ? 'Finish payment' : 'Join the next batch'}</Link>
        </div>
        {wa && <p className="t-small" style={{ marginTop: 16 }}>Paid already, or on our learner list? <a className="link link-s" href={wa} target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a></p>}
      </>
    )
  }

  const course = Array.isArray(row.courses) ? row.courses[0] : row.courses
  const batch = Array.isArray(row.batches) ? row.batches[0] : row.batches
  // The order behind a purchase, for "Paid by UPI. Order CC-2026-000118".
  const order = row.order_item_id
    ? (await a.db.from('orders').select('order_no, total_minor, currency, paid_at, payments(gateway, status), order_items!inner(id)')
        .eq('order_items.id', row.order_item_id).maybeSingle()).data
    : null
  const now = nowMs()
  const ended = row.status === 'expired' || (row.expires_at ? new Date(row.expires_at).getTime() <= now : false)
  const [tone, word] = ended ? (['quiet', 'Ended'] as [Tone, string]) : (STATUS[row.status] ?? (['quiet', row.status] as [Tone, string]))
  const left = row.expires_at && !ended ? daysUntil(row.expires_at, now) : null
  const soon = left !== null && left <= 30

  // Where today sits between the first day and the last (0 to 100).
  const span = row.expires_at ? new Date(row.expires_at).getTime() - new Date(row.started_at).getTime() : 0
  const at = span > 0 ? Math.max(0, Math.min(100, Math.round(((now - new Date(row.started_at).getTime()) / span) * 100))) : null

  const via = order?.payments?.find((p) => p.status === 'captured')?.gateway
  const source = row.source === 'purchase'
    ? `${via === 'upi_manual' ? 'Paid by UPI' : 'Paid online'}${order ? ` · order ${order.order_no} · ${money(order.total_minor, order.currency)}${order.paid_at ? ` on ${dateLong(order.paid_at)}` : ''}.` : '.'}`
    : SOURCE[row.source] ?? 'Access added.'

  // Outcome first: one sentence that answers the question.
  const answer = ended
    ? <>Your access has ended. Your notes and certificate stay.</>
    : row.status === 'paused' ? <>Your access is paused. Message us to restart it.</>
    : row.expires_at ? <>Your access is active until <b>{dateLong(row.expires_at)}</b>.</> : <>Your access is active, with no end date.</>

  return (
    <>
      <div className="pg-h"><div>
        <h1 className="t-title">Subscription</h1>
        <p className="t-lead">{answer}</p>
      </div></div>

      {soon && (
        <p role="status" className="banner">
          <Ic n="clock" /><span className="t-card">Ends in {left} {left === 1 ? 'day' : 'days'}.</span>
          <span className="t-small">After that, lessons lock. Notes stay for 30 days.</span>
          {wa && <a className="link link-s" href={wa} target="_blank" rel="noopener noreferrer">Message us to extend</a>}
        </p>
      )}

      <article className="pass" aria-labelledby="pass-h">
        <div className="pass-top">
          <div className="who">
            <p className="t-label">Your program</p>
            <h2 className="t-h3" id="pass-h">{course?.title ?? 'Your course'}</h2>
            <p className="t-small">{[batch?.name, `started ${dateLong(row.started_at)}`].filter(Boolean).join(' · ')}</p>
            <p style={{ marginTop: 4 }}><St tone={tone}>{word}</St></p>
          </div>
          {left !== null && (
            <p className="pass-days"><span className="t-num tnum">{left}</span><span className="t-label">{left === 1 ? 'day' : 'days'} of access left</span></p>
          )}
        </div>
        {at !== null && row.expires_at && (
          <div className="tl" aria-hidden="true">
            <div className="tl-bar"><i style={{ width: `${at}%` }} /><b style={{ left: `${at}%` }} /></div>
            <div className="tl-lb">
              <span>{dateLong(row.started_at)}</span>
              {!ended && <span>Today</span>}
              <span>{dateLong(row.expires_at)}</span>
            </div>
          </div>
        )}
        <p className="pass-src">
          <Ic n="check" s /><span>{source}</span>
          {order && <Link className="link" href="/account/payments">See payments</Link>}
        </p>
      </article>

      <dl className="facts blk">
        <div><dt>Started</dt><dd>{dateLong(row.started_at)}</dd><span /></div>
        <div><dt>Access until</dt><dd>{row.expires_at ? dateLong(row.expires_at) : 'No end date'}</dd><span /></div>
        <div>
          <dt>Progress</dt>
          <dd>{row.lessons_completed} of {row.lessons_total} lessons <span>· {Math.round(Number(row.progress_pct))}%</span></dd>
          {course?.slug && !ended ? <Link className="link link-s" href={`/learn/${course.slug}/material`} style={{ minHeight: 0 }}>Open my course</Link> : <span />}
        </div>
        <div><dt>After it ends</dt><dd><span>Lessons lock. You keep your notes for 30 days and your certificate for good.</span></dd><span /></div>
      </dl>

      <div className="form-act" style={{ marginTop: 20 }}>
        {wa && <a className="btn btn-line btn-sm" href={wa} target="_blank" rel="noopener noreferrer"><Wa />Ask about my access</a>}
        {refunds && <Link className="link link-s" href={refunds.href}>Refund policy</Link>}
      </div>
    </>
  )
}
