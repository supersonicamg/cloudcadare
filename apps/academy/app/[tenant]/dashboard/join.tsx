import Link from 'next/link'
import type { ReactNode } from 'react'
import { istDate, type BatchInfo, type JoinState } from '@/lib/dashboard'
import { courseAbbr, dateShort, timeShort } from '@/lib/format'
import { dayNum, monthName } from '@/lib/live'
import { money } from '@/lib/money'
import { startCheckout } from '../checkout/actions'
import { Dg, Ic, Wa, diagramOfMonth } from '../_components/v11'
import { joinListedBatch } from './actions'
import { Cal, MonthCards, Week, type MonthCardData } from './parts'

export interface JoinProps { s: JoinState; first: string; whatsapp: string | null; checkout: boolean; syllabusHref?: string }

type Sections = NonNullable<JoinState['course']>['sections']
const lessonsOf = (sections: Sections) => sections.flatMap((m) => [...m.lessons, ...m.children.flatMap((c) => c.lessons)])
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const waLink = (p: JoinProps, text: string) => (p.whatsapp ? `${p.whatsapp.split('?')[0]}?text=${encodeURIComponent(text)}` : null)

/** The way to buy: the real checkout when a product sells the course, otherwise the course page. */
function Buy({ p, filled, label }: { p: JoinProps; filled: boolean; label: string }) {
  const { course } = p.s
  const cls = `btn${filled ? '' : ' btn-line'}`
  if (!course) return p.whatsapp ? <a href={p.whatsapp} target="_blank" rel="noopener noreferrer" className={cls}>Ask us on WhatsApp</a> : null
  if (course.offer && p.checkout) {
    return <form action={startCheckout.bind(null, course.offer.productId, course.offer.priceId, course.slug)}><button type="submit" className={cls}>{label}</button></form>
  }
  return <Link href={`/courses/${course.slug}`} className={cls}>See the program</Link>
}

function Price({ s }: { s: JoinState }) {
  const o = s.course?.offer
  if (!o) return null
  return <span className="t-num">{money(o.amountMinor, o.currency)}<small>{o.taxIncluded && o.taxLabel ? `incl. ${o.taxLabel}` : 'one payment'}</small></span>
}

/** The program's months before you join: title, how many lessons, how many labs. */
function Program({ s, title, lead }: { s: JoinState; title: string; lead?: string }) {
  const sections = s.course?.sections ?? []
  if (!sections.length) return null
  const months: MonthCardData[] = sections.map((m) => {
    const lessons = [...m.lessons, ...m.children.flatMap((c) => c.lessons)]
    const labs = lessons.filter((l) => l.type === 'lab').length
    return { id: m.id, title: m.title, state: 'open', line: `${plural(lessons.length, 'lesson')}${labs ? ` · ${plural(labs, 'lab')}` : ''}` }
  })
  return (
    <section className="blk" aria-labelledby="prog-h">
      <div className="blk-h"><h2 className="t-h3" id="prog-h">{title}</h2>{lead && <p className="t-small">{lead}</p>}</div>
      <MonthCards months={months} />
    </section>
  )
}

/** The lessons anyone can open, as picture + title + line. */
function FreeLessons({ s, max, title, lead }: { s: JoinState; max: number; title: (n: number) => string; lead: string }) {
  const course = s.course
  if (!course) return null
  const free = course.sections.flatMap((m, i) => lessonsOf([m]).filter((l) => l.isPreview).map((l) => ({ l, month: i + 1 }))).slice(0, max)
  if (!free.length) return null
  return (
    <section className="blk" aria-labelledby="free-h">
      <div className="blk-h"><h2 className="t-h3" id="free-h">{title(free.length)}</h2><p className="t-small">{lead}</p></div>
      <ul className="previews">
        {free.map(({ l, month }) => (
          <li key={l.id}>
            <Link className="pv card" href={`/courses/${course.slug}/preview/${l.id}`}>
              <Dg id={diagramOfMonth(month)} />
              <span className="tx">
                <b className="t-card">{l.title}</b>
                <span className="t-label">{[l.type === 'video' || l.type === 'live' ? 'Video' : 'Reading', l.durationSeconds ? `${Math.max(1, Math.round(l.durationSeconds / 60))} min` : null, `Month ${month}`].filter(Boolean).join(' · ')}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

const Note = ({ children }: { children: ReactNode }) => <p className="note-l top"><Ic n="info" /><span>{children}</span></p>

/** The batch ticket with the way in on the right: the price and "Join the 12 Jan batch", or "Join my batch now". */
function Ticket({ cal, week, children }: { cal: ReactNode; week?: ReactNode; children: ReactNode }) {
  return (
    <div className="band">
      <div className={`ticket${week ? '' : ' two'}`}>
        {cal}
        {week}
        <div className="fee">{children}</div>
      </div>
    </div>
  )
}

/** E4: the learner's confirmed email is on the learner list. One filled button: "Join my batch now". */
function Listed(p: JoinProps) {
  const { s } = p
  const listed = s.listed!
  const abbr = courseAbbr(listed.courseTitle)
  const wa = waLink(p, `My email ${listed.email} is on the learner list but the batch looks wrong.`)
  const start = listed.batchStart ? istDate(listed.batchStart) : null
  const next = s.next
  return (
    <>
      <div className="pg-h">
        <div>
          <h1 className="t-title">Hi {p.first}, which batch are you in?</h1>
          <p className="t-lead">Pick your batch and we&apos;ll open the right material.</p>
        </div>
      </div>
      <Ticket cal={<Cal start={start} foot={listed.batchName ?? abbr} />}>
        <p className="t-label"><b>Matches your email</b></p>
        <span className="t-card">{listed.running ? 'You seem to be in the current batch' : 'Your email is on our learner list'}</span>
        <p className="t-small"><b>{listed.email}</b> is on the list for {abbr}. No payment, you&apos;re already registered.{listed.running ? ' Class recordings open as soon as you join.' : ''}</p>
        <form action={joinListedBatch}><button type="submit" className="btn">Join my batch now</button></form>
        {wa && <a className="link" href={wa} target="_blank" rel="noopener noreferrer"><Wa />Not you? Tell us on WhatsApp</a>}
      </Ticket>
      {next && (
        <section className="blk" aria-labelledby="o-next">
          <div className="card soft-next">
            <Cal2 batch={next} />
            <div>
              <h2 className="t-card" id="o-next">Join the next batch instead</h2>
              <p className="t-small">{next.name}{next.startDate ? ` · starts ${dateShort(istDate(next.startDate))}` : ''}{next.schedule ? ` · ${next.schedule}` : ''}</p>
            </div>
            <div className="acts-r"><div className="fx"><Price s={s} /></div><Buy p={p} filled={false} label="Join the next batch" /></div>
          </div>
        </section>
      )}
      <Program s={s} title={`${abbr} at a glance`} lead="Each month builds on the last." />
    </>
  )
}

/** The small date block of a batch that starts later. */
function Cal2({ batch }: { batch: BatchInfo }) {
  if (!batch.startDate) return <span className="dblk" aria-hidden="true"><Ic n="cal" /></span>
  const d = istDate(batch.startDate)
  return <span className="dblk" aria-hidden="true"><b>{dayNum(d)}</b><span>{monthName(d)}</span></span>
}

/** E6: paid by UPI, staff are checking. No filled button: there is nothing to do but wait. */
function Checking(p: JoinProps) {
  const { s } = p
  const order = s.order!
  const placed = order.placed_at ? `${dateShort(order.placed_at)}, ${timeShort(order.placed_at)}` : ''
  const sent = Boolean(s.proof?.file_path)
  const wa = waLink(p, `Payment screenshot for order ${order.order_no}`)
  const steps: Array<{ title: string; detail: string; on: boolean; now?: boolean }> = [
    { title: 'Order placed', detail: placed, on: true },
    { title: 'You paid by UPI', detail: s.proof ? dateShort(s.proof.submitted_at) : '', on: true },
    { title: 'We verify it', detail: 'We check it with our bank', on: false, now: true },
    { title: 'Seat confirmed', detail: 'We tell you at once', on: false },
  ]
  return (
    <>
      <div className="pg-h">
        <div>
          <h1 className="t-title">Thanks {p.first}, we&apos;re checking your payment</h1>
          <p className="t-lead">Order {order.order_no} · {money(order.total_minor, order.currency)}</p>
        </div>
      </div>
      <ol className="todo rows" aria-label="Order progress">
        {steps.map((t) => (
          <li key={t.title} aria-current={t.now ? 'step' : undefined}>
            <span className={`ck${t.on ? ' on' : ''}`}>{t.on && <Ic n="check" s />}<span className="sr">{t.on ? 'Done' : t.now ? 'Now' : 'To do'}</span></span>
            <span className="tx"><b className="t-card">{t.title}</b>{t.detail && <span>{t.detail}</span>}</span>
            <span />
          </li>
        ))}
      </ol>
      <div className="acts-r gap-t">
        {!sent && wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-line">Send the screenshot on WhatsApp</a>}
        <Link href={`/checkout/${order.id}/pending`} className="link">See where it stands</Link>
      </div>
      <FreeLessons s={s} max={3} title={() => 'Open while you wait'} lead="Free preview lessons" />
    </>
  )
}

/** E5: no course yet and not on the list (also: an order still waiting to be paid, or one we could not match). */
function Join(p: JoinProps) {
  const { s } = p
  const abbr = s.course ? courseAbbr(s.course.title) : 'the program'
  const rejected = s.order && s.proof?.state === 'rejected'
  const unpaid = s.order && !rejected
  const batch = s.next
  const start = batch?.startDate ? istDate(batch.startDate) : null
  const months = s.course?.sections.length ?? 0
  const wa = waLink(p, `I have a question about ${abbr}.`)
  const alreadyWa = waLink(p, `I am already a student. Please add my course to ${s.email}.`)
  return (
    <>
      <div className="pg-h">
        <div>
          <h1 className="t-title">
            {rejected ? <>Hi {p.first}, we could not match your payment</>
              : unpaid ? <>Hi {p.first}, your order is waiting for payment</>
              : <>Welcome, {p.first}</>}
          </h1>
          <p className="t-lead">{unpaid || rejected ? `Order ${s.order!.order_no} · ${money(s.order!.total_minor, s.order!.currency)}` : 'Your account is ready. Join a batch to open the lessons and live classes.'}</p>
        </div>
        {(unpaid || rejected) && <Link href={rejected ? `/checkout/${s.order!.id}/pending` : `/checkout/${s.order!.id}`} className="btn">{rejected ? 'Fix the payment' : 'Pay now'}</Link>}
      </div>

      {!s.verified && s.codeRequired && <Note><b>Already one of our students?</b> <Link className="link link-s" href="/signup/confirm?next=%2Fdashboard">Confirm your email</Link> so we can check the learner list.</Note>}
      {!s.verified && !s.codeRequired && alreadyWa && <Note><b>Already one of our students?</b> <a className="link link-s" href={alreadyWa} target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a> and we will add your course.</Note>}

      {!(unpaid || rejected) && (
        <>
          <Ticket cal={<Cal start={start} foot={months ? `${plural(months, 'month')}, live online` : 'Live online'} />} week={batch ? <Week batch={batch} /> : undefined}>
            <p className="t-label"><b>Fee</b></p>
            <Price s={s} />
            {batch && <p className="t-small">{batch.name}{s.daysToNext && s.daysToNext > 0 ? ` · starts in ${plural(s.daysToNext, 'day')}` : ''}</p>}
            <Buy p={p} filled label={start ? `Join the ${dateShort(start)} batch` : 'Join the program'} />
            {wa && <a className="link" href={wa} target="_blank" rel="noopener noreferrer"><Wa />Ask on WhatsApp</a>}
            {p.syllabusHref && <a className="link" href={p.syllabusHref}><Ic n="down" />Download the syllabus</a>}
          </Ticket>
          {s.verified && s.runningBatch && (
            <div className="gap-t">
              <Note><b>Already in the {s.runningBatch}?</b> We could not find {s.email} on its list. Log in with the email you gave at admission{p.whatsapp ? <>, or <a className="link link-s" href={waLink(p, `I am in the ${s.runningBatch}, please add my email ${s.email}`)!} target="_blank" rel="noopener noreferrer">message us on WhatsApp</a> and we will add it</> : ''}.</Note>
            </div>
          )}
          <FreeLessons s={s} max={4} title={(n) => `Try ${plural(n, 'free lesson')} first`} lead="No payment needed" />
        </>
      )}
      <Program s={s} title="What you will learn" lead="Month by month" />
    </>
  )
}

export function NoCourseDashboard(p: JoinProps) {
  if (p.s.order && p.s.proof?.state === 'pending_review') return <Checking {...p} />
  if (p.s.listed) return <Listed {...p} />
  return <Join {...p} />
}
