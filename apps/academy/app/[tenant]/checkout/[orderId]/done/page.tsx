import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { requireMember } from '@/lib/dal'
import { istDate, scheduleLine } from '@/lib/dashboard'
import { courseAbbr, dateLong, nowMs, timeShort } from '@/lib/format'
import { money } from '@/lib/money'
import { getShell } from '@/lib/shell'
import { Ic, V11Frame } from '../../../_components/v11'
import { CheckoutBar } from '../../../_components/v11-bars'

export const metadata = { title: 'Payment received' }

/*
 * Payment verified.
 * 1. One job: confirm the course is open, in the first words.
 * 2. One main action: "Start learning". The receipt is a quiet text link.
 * 3. Reading order: ink tick -> "Payment received. {course} is open." -> facts (order, amount, when) -> Start learning
 *    -> receipt link. Beside it, when the batch has not started yet: the day it starts.
 */
const parts = (d: Date) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', weekday: 'short', month: 'short', timeZone: 'Asia/Kolkata' }).formatToParts(d)

export default async function Done({ params }: PageProps<'/[tenant]/checkout/[orderId]/done'>) {
  const { orderId } = await params
  if (!z.uuid().safeParse(orderId).success) notFound()
  const a = await requireMember(`/checkout/${orderId}/done`)
  const [{ brand }, order, items, enr] = await Promise.all([
    getShell(),
    a.db.from('orders').select('order_no, status, total_minor, currency, paid_at').eq('id', orderId).eq('member_id', a.memberId).maybeSingle(),
    a.db.from('order_items').select('id, title_snapshot').eq('order_id', orderId),
    a.db.from('enrollments').select('expires_at, batch_id, courses(slug)').eq('member_id', a.memberId).eq('source', 'purchase').order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (!order.data) notFound()
  const o = order.data
  if (o.status !== 'paid') redirect(`/checkout/${orderId}/pending`)
  const names = items.data?.map((i) => i.title_snapshot) ?? []
  const title = names.length === 1 ? courseAbbr(names[0]!) : names.join(', ') || 'Your course'
  const course = Array.isArray(enr.data?.courses) ? enr.data?.courses[0] : enr.data?.courses
  // The batch is shown only while it is still ahead: a running batch has nothing to announce.
  const batchRow = enr.data?.batch_id ? (await a.db.from('batches').select('name, start_date, schedule').eq('id', enr.data.batch_id).maybeSingle()).data : null
  const start = batchRow?.start_date ? istDate(batchRow.start_date) : null
  const upcoming = start && start.getTime() > nowMs() ? start : null
  const when = upcoming ? parts(upcoming) : null
  const get = (t: string) => when?.find((p) => p.type === t)?.value ?? ''

  return (
    <V11Frame shell="focus" header={<CheckoutBar brand={brand} middle="Your payment" exit={{ href: '/account/payments', label: 'Close' }} />}>
      <div className="pst">
        <div className="pst-main">
          <span className="bigok" aria-hidden="true"><Ic n="check" /></span>
          <div>
            <h1 className="t-title">Payment received. {title} is open.</h1>
            <p className="t-lead" style={{ marginTop: 8 }}>Your lessons, live classes and notes are ready.</p>
          </div>
          <dl className="facts">
            <div><dt>Order</dt><dd className="tnum">{o.order_no}</dd><span /></div>
            <div><dt>Amount paid</dt><dd className="tnum">{money(o.total_minor, o.currency)}</dd><span /></div>
            {o.paid_at && <div><dt>Verified</dt><dd>{dateLong(o.paid_at)}, {timeShort(o.paid_at)}</dd><span /></div>}
            <div><dt>Access</dt><dd>{enr.data?.expires_at ? `Until ${dateLong(enr.data.expires_at)}` : 'No end date'}</dd><span /></div>
          </dl>
          <div className="form-act">
            <Link href={course?.slug ? `/learn/${course.slug}` : '/dashboard'} className="btn">Start learning</Link>
            <Link href={`/orders/${orderId}`} className="link">See your receipt</Link>
          </div>
        </div>
        {upcoming && batchRow && (
          <aside className="card" style={{ padding: 20, display: 'grid', gap: 14 }}>
            <p className="t-label">Your batch starts</p>
            <div className="ncls-row">
              <span className="dblk"><b>{get('day')}</b><span>{get('weekday')} · {get('month')}</span></span>
              <div>
                <p className="t-card">{dateLong(upcoming)}</p>
                {scheduleLine(batchRow.schedule) && <p className="t-small">{scheduleLine(batchRow.schedule)}</p>}
              </div>
            </div>
          </aside>
        )}
      </div>
    </V11Frame>
  )
}
