import Link from 'next/link'
import { Icon } from '@educore/ui/marks'
import { requireMember } from '@/lib/dal'
import { dateLong, daysUntil, nowMs } from '@/lib/format'
import { money } from '@/lib/money'
import { getShell } from '@/lib/shell'
import { buttonLg, buttonOutline, h1s, lead } from '@/lib/ui'
import { Fact, Facts, Note, Panel, StatusChip } from '../../_components/parts'

export const metadata = { title: 'Subscription' }

/*
 * C3 · Subscription ("do I have access, until when, and why?").
 * 1. One job: answer that question in the first line.
 * 2. One main action: none while access is active. With no access: "Join the next batch" (the only filled button).
 * 3. Reading order: title -> the answer as a sentence -> the plan panel (dominant: course, batch, status chip) ->
 *    how I got access (one note) -> facts list -> quiet WhatsApp and refund links.
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

const STATUS = {
  active: ['ok', 'Active'], paused: ['wait', 'Paused'], completed: ['ok', 'Completed'],
  expired: ['quiet', 'Ended'], cancelled: ['quiet', 'Cancelled'], refunded: ['quiet', 'Refunded'],
} as const

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
  const wa = brand.contact?.whatsapp?.replace(/\D/g, '')
  const waHref = wa && wa.length >= 8 ? `https://wa.me/${wa}?text=${encodeURIComponent('Hi, I have a question about my access.')}` : null
  const refunds = site?.legal?.find((l) => /refund/i.test(l.label))

  // ---- No access yet
  if (!row) {
    const unpaidId = unpaid.data?.[0]?.id
    return (
      <section aria-labelledby="sub-h" className="grid gap-6">
        <div className="grid gap-3">
          <h1 id="sub-h" className={h1s}>Subscription</h1>
          <p className={lead}>{unpaidId ? 'Your order is waiting for payment.' : 'You do not have access to a course yet.'}</p>
        </div>
        <Panel className="grid gap-5">
          <p className="t-body !text-fg">{unpaidId ? 'Pay to unlock the course. Your order is saved.' : 'Join the next batch to unlock the lessons, live classes and notes.'}</p>
          <div><Link href={unpaidId ? `/checkout/${unpaidId}` : '/courses'} className={buttonLg}>{unpaidId ? 'Finish payment' : 'Join the next batch'}</Link></div>
        </Panel>
      </section>
    )
  }

  const course = Array.isArray(row.courses) ? row.courses[0] : row.courses
  const batch = Array.isArray(row.batches) ? row.batches[0] : row.batches
  // The order behind a purchase, for "Paid by UPI. Order CC-2026-000118".
  const order = row.order_item_id
    ? (await a.db.from('orders').select('order_no, total_minor, currency, paid_at, payments(gateway, status), order_items!inner(id)')
        .eq('order_items.id', row.order_item_id).maybeSingle()).data
    : null
  const ended = row.status === 'expired' || (row.expires_at ? new Date(row.expires_at).getTime() <= nowMs() : false)
  const [tone, word] = ended ? (['quiet', 'Ended'] as const) : (STATUS[row.status as keyof typeof STATUS] ?? (['quiet', row.status] as const))
  const left = row.expires_at && !ended ? daysUntil(row.expires_at, nowMs()) : null
  const soon = left !== null && left <= 30

  const via = order?.payments?.find((p) => p.status === 'captured')?.gateway
  const source = row.source === 'purchase'
    ? `${via === 'upi_manual' ? 'Paid by UPI' : 'Paid online'}${order ? `. Order ${order.order_no}, ${money(order.total_minor, order.currency)}${order.paid_at ? `, ${dateLong(order.paid_at)}` : ''}.` : '.'}`
    : SOURCE[row.source] ?? 'Access added.'

  // Outcome first: one sentence that answers the question.
  const answer = ended
    ? 'Your access has ended. Your notes and certificate stay.'
    : row.status === 'paused' ? 'Your access is paused. Message us to restart it.'
    : row.expires_at ? `Your access is active until ${dateLong(row.expires_at)}.` : 'Your access is active, with no end date.'

  return (
    <div className="grid gap-8">
      <section aria-labelledby="sub-h" className="grid gap-6">
        <div className="grid gap-3">
          <h1 id="sub-h" className={h1s}>Subscription</h1>
          <p className={lead}>{answer}</p>
        </div>

        {soon && (
          <p role="status" className="t-body flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-tint-2 px-5 py-4 !text-fg">
            <Icon name="clock" className="h-5 w-5 shrink-0" />
            <span className="font-semibold">Ends in {left} {left === 1 ? 'day' : 'days'}.</span>
            {waHref && <a href={waHref} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">Message us to extend</a>}
          </p>
        )}

        <Panel className="grid gap-5">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="grid min-w-0 gap-1.5">
              <h2 className="t-card">{course?.title ?? 'Your course'}</h2>
              <p className="t-label">{[batch?.name, batch?.start_date ? `starts ${dateLong(batch.start_date)}` : null].filter(Boolean).join(' · ') || 'Live online'}</p>
            </div>
            <StatusChip tone={tone}>{word}</StatusChip>
          </div>
          <Note icon="check">{source}{order && <> <Link href="/account/payments" className="font-semibold text-primary underline underline-offset-4">See payments</Link></>}</Note>
        </Panel>
      </section>

      <section aria-labelledby="sub-f" className="grid gap-4">
        <h2 id="sub-f" className="sr-only">Details</h2>
        <Facts>
          <Fact label="Started">{dateLong(row.started_at)}</Fact>
          <Fact label="Access until">{row.expires_at ? dateLong(row.expires_at) : 'No end date'}</Fact>
          <Fact label="Progress" aside={course?.slug && !ended ? <Link href={`/learn/${course.slug}`} className="t-label !text-primary hover:underline">Open <span aria-hidden="true">→</span></Link> : undefined}>
            {row.lessons_completed} of {row.lessons_total} lessons · {Math.round(Number(row.progress_pct))}%
          </Fact>
          <Fact label="After it ends">Lessons lock. You keep your notes for 30 days and your certificate for good.</Fact>
        </Facts>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
          {waHref && <a href={waHref} target="_blank" rel="noopener noreferrer" className={buttonOutline}>Ask about my access</a>}
          {refunds && <Link href={refunds.href} className="t-label !text-fg underline underline-offset-4">Refund policy</Link>}
        </div>
      </section>
    </div>
  )
}
