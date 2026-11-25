import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon, type IconName } from '@educore/ui/marks'
import { istDate, type BatchInfo, type JoinState } from '@/lib/dashboard'
import { courseAbbr, dateLong, dateShort, timeShort } from '@/lib/format'
import { dayOfMonth, monthName, weekday } from '@/lib/live'
import { money } from '@/lib/money'
import { buttonLg, buttonOutline } from '@/lib/ui'
import { startCheckout } from '../checkout/actions'
import { joinListedBatch } from './actions'
import { Climb } from './climb'

const Arrow = () => <span aria-hidden="true">→</span>
const Facts = ({ items }: { items: Array<[IconName, ReactNode] | null> }) => (
  <ul className="ld-facts">{items.filter((i) => i !== null).map(([icon, text], n) => <li key={n}><Icon name={icon} className="h-[18px] w-[18px] shrink-0 text-primary" /><span>{text}</span></li>)}</ul>
)

export interface JoinProps { s: JoinState; first: string; whatsapp: string | null; checkout: boolean; syllabusHref?: string; goal?: string }

const courseFacts = (s: JoinState, batch: BatchInfo | null): Array<[IconName, ReactNode] | null> => [
  batch?.schedule ? ['calendar', batch.schedule] : null,
  s.course?.lessonCount ? ['book', `${s.course.lessonCount} lessons`] : null,
  ['live', 'Live classes, with recordings'],
]

/** The way to buy: the real checkout when a product sells the course, otherwise the course page. */
function Buy({ p, filled, label }: { p: JoinProps; filled: boolean; label: string }) {
  const { course } = p.s
  const cls = `${filled ? buttonLg : `${buttonOutline} !h-14`} w-full`
  if (!course) return p.whatsapp ? <a href={p.whatsapp} target="_blank" rel="noopener noreferrer" className={cls}>Ask us on WhatsApp</a> : null
  if (course.offer && p.checkout) {
    return <form action={startCheckout.bind(null, course.offer.productId, course.offer.priceId, course.slug)}><button type="submit" className={cls}>{label} {filled && <Arrow />}</button></form>
  }
  return <Link href={`/courses/${course.slug}`} className={cls}>See the program {filled && <Arrow />}</Link>
}

function Price({ s }: { s: JoinState }) {
  const o = s.course?.offer
  if (!o) return null
  return <p className="ld-price"><b>{money(o.amountMinor, o.currency)}</b><span>{o.taxIncluded && o.taxLabel ? `incl. ${o.taxLabel}` : 'one payment'}</span></p>
}

function NextBadge({ batch, soft }: { batch: BatchInfo | null; soft?: boolean }) {
  if (!batch?.startDate) return <span className={`ld-date${soft ? ' soft' : ''}`}><Icon name="calendar" className="h-8 w-8" /></span>
  const d = istDate(batch.startDate)
  return <span className={`ld-date${soft ? ' soft' : ''}`}><b>{dayOfMonth(d)}</b><span>{weekday(d)} · {monthName(d)}</span></span>
}

function Program({ s, title, lead, syllabusHref, goal }: { s: JoinState; title: string; lead: string; syllabusHref?: string; goal?: string }) {
  const sections = s.course?.sections ?? []
  if (!sections.length) return null
  return (
    <section aria-labelledby="prog-h" className="ld-panel mist ld-s">
      <div className="ld-wrap">
        <div className="ld-head"><div><h2 id="prog-h" className="ld-h2">{title}</h2><p>{lead}</p></div>{syllabusHref && <a href={syllabusHref} className="ld-link"><Icon name="down" className="h-4 w-4" />Download the syllabus</a>}</div>
        <Climb label="Months of the program" goal={goal} steps={sections.map((m, i) => {
          const lessons = [...m.lessons, ...m.children.flatMap((c) => c.lessons)]
          const labs = lessons.filter((l) => l.type === 'lab').length
          return { key: m.id, number: String(i + 1).padStart(2, '0'), title: m.title, state: 'open', detail: `${lessons.length} ${lessons.length === 1 ? 'lesson' : 'lessons'}${labs ? ` · ${labs} labs` : ''}` }
        })} />
      </div>
    </section>
  )
}

/** E4: the learner's confirmed email is on the learner list. One filled button: "Join my batch now". */
function Listed(p: JoinProps) {
  const { s } = p
  const listed = s.listed!
  const abbr = courseAbbr(listed.courseTitle)
  const wa = p.whatsapp ? `${p.whatsapp.split('?')[0]}?text=${encodeURIComponent(`My email ${listed.email} is on the learner list but the batch looks wrong.`)}` : null
  return (
    <>
      <section aria-labelledby="dash-h" className="ld-s tight">
        <div className="ld-wrap ld-hi">
          <h1 id="dash-h" className="ld-h1">Hi {p.first}, which batch are you in?</h1>
          <p className="ld-meta">Pick your batch and we&apos;ll open the right material.</p>
        </div>
      </section>
      <section aria-label="Choose your batch" className="ld-panel ld-s">
        <div className="ld-wrap">
          <div className={s.next ? 'ld-choice' : 'grid max-w-[640px]'}>
            <article className="ld-opt pick" aria-labelledby="o-cur">
              <span className="match"><Icon name="check" className="h-3.5 w-3.5" />Matches your email</span>
              <div className="oh"><span className="ld-date"><Icon name="check" className="h-9 w-9 text-accent" /></span><div><h2 id="o-cur">{listed.running ? 'You seem to be in the current batch' : 'Your email is on our learner list'}</h2><p>{[listed.batchName ?? abbr, listed.batchStart ? `${listed.running ? 'started' : 'starts'} ${dateShort(istDate(listed.batchStart))}` : null].filter(Boolean).join(' · ')}</p></div></div>
              <p className="email"><Icon name="user" className="h-[18px] w-[18px] shrink-0 text-primary" /><span><b>{listed.email}</b> is on the list for {abbr}</span></p>
              <Facts items={[['check', "No payment, you're already registered"], listed.running ? ['live', 'Class recordings open as soon as you join'] : null]} />
              <div className="foot">
                <form action={joinListedBatch}><button type="submit" className={`${buttonLg} w-full`}>Join my batch now <Arrow /></button></form>
                {wa && <p className="ld-small">Not you, or the wrong batch? <a href={wa} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-4">Tell us on WhatsApp</a></p>}
              </div>
            </article>
            {s.next && (
              <article className="ld-opt" aria-labelledby="o-next">
                <div className="oh"><NextBadge batch={s.next} soft /><div><h2 id="o-next">Join the next batch</h2><p>{s.next.name}{s.next.startDate ? ` · starts ${dateShort(istDate(s.next.startDate))}` : ''}</p></div></div>
                <Facts items={courseFacts(s, s.next)} />
                <div className="foot"><Price s={s} /><Buy p={p} filled={false} label="Join the next batch instead" /></div>
              </article>
            )}
          </div>
        </div>
      </section>
      <Program s={s} title={`${abbr} at a glance`} lead="Each month builds on the last." syllabusHref={p.syllabusHref} goal={p.goal} />
    </>
  )
}

/** E6: paid by UPI, staff are checking. No filled button: there is nothing to do but wait. */
function Checking(p: JoinProps) {
  const { s } = p
  const order = s.order!
  const lessons = (s.course?.sections ?? []).flatMap((m) => [...m.lessons, ...m.children.flatMap((c) => c.lessons)])
  const free = lessons.filter((l) => l.isPreview).slice(0, 3)
  const placed = order.placed_at ? `${dateShort(order.placed_at)}, ${timeShort(order.placed_at)}` : ''
  const sent = Boolean(s.proof?.file_path)
  const wa = p.whatsapp ? `${p.whatsapp.split('?')[0]}?text=${encodeURIComponent(`Payment screenshot for order ${order.order_no}`)}` : null
  return (
    <>
      <section aria-labelledby="dash-h" className="ld-s tight">
        <div className="ld-wrap grid gap-7">
          <div className="ld-hi">
            <h1 id="dash-h" className="ld-h1">Thanks {p.first}, we&apos;re checking your payment</h1>
            <p className="ld-meta">Order {order.order_no} · {money(order.total_minor, order.currency)}</p>
          </div>
          <ol className="ld-track" aria-label="Order progress">
            <li><span className="n">01<Icon name="check" /></span><b>Order placed</b><span className="d">{placed}</span></li>
            <li><span className="n">02<Icon name="check" /></span><b>You paid by UPI</b><span className="d">{s.proof ? dateShort(s.proof.submitted_at) : ''}</span></li>
            <li className="now" aria-current="step"><span className="n">03</span><b>We verify it</b><span className="d">We check it with our bank</span></li>
            <li className="todo"><span className="n">04</span><b>Seat confirmed</b><span className="d">We tell you at once</span></li>
          </ol>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {!sent && wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonOutline}>Send the screenshot on WhatsApp</a>}
            <Link href={`/checkout/${order.id}/pending`} className="ld-link">See where it stands <Arrow /></Link>
          </div>
        </div>
      </section>
      {free.length > 0 && (
        <section aria-labelledby="free-h" className="ld-panel ld-s">
          <div className="ld-wrap">
            <div className="ld-head"><div><h2 id="free-h" className="ld-h2">Open while you wait</h2><p>Free preview lessons.</p></div></div>
            <div className="ld-rows max-w-[760px]">
              {free.map((l) => (
                <Link key={l.id} href={`/courses/${s.course!.slug}/preview/${l.id}`} className="ld-row"><span className="ti"><Icon name={l.type === 'video' || l.type === 'live' ? 'play' : 'doc'} className="h-5 w-5" /></span><span><b>{l.title}</b><span className="s">{l.durationSeconds ? `${Math.max(1, Math.round(l.durationSeconds / 60))} min · ` : ''}Free preview</span></span><span className="tag">Open</span></Link>
              ))}
            </div>
          </div>
        </section>
      )}
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
  return (
    <>
      <section aria-labelledby="dash-h" className="ld-s tight">
        <div className="ld-wrap ld-stack">
          <div className="ld-hi">
            <h1 id="dash-h" className="ld-h1">
              {rejected ? <>Hi {p.first}, we could not match your payment</>
                : unpaid ? <>Hi {p.first}, your order is waiting for payment</>
                : <>Hi {p.first}, your seat in {abbr} is <em>one step away</em></>}
            </h1>
            <p className="ld-meta">{unpaid || rejected ? `Order ${s.order!.order_no} · ${money(s.order!.total_minor, s.order!.currency)}`
              : batch?.startDate ? `${s.runningBatch ? 'The current batch is running. ' : ''}The next one starts on ${dateShort(istDate(batch.startDate))}.` : 'Next batch dates are coming soon.'}</p>
          </div>
          {!s.verified && s.codeRequired && <p className="ld-note"><Icon name="info" className="mt-0.5 h-5 w-5 shrink-0" /><span><b>Already one of our students?</b> <Link href="/signup/confirm?next=%2Fdashboard">Confirm your email</Link> so we can check the learner list.</span></p>}
          {!s.verified && !s.codeRequired && p.whatsapp && <p className="ld-note"><Icon name="info" className="mt-0.5 h-5 w-5 shrink-0" /><span><b>Already one of our students?</b> <a href={`${p.whatsapp}?text=${encodeURIComponent(`I am already a student. Please add my course to ${s.email}.`)}`} target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a> and we will add your course.</span></p>}
          {(unpaid || rejected) && (
            <div><Link href={rejected ? `/checkout/${s.order!.id}/pending` : `/checkout/${s.order!.id}`} className={`${buttonLg} max-[820px]:w-full`}>{rejected ? 'Fix the payment' : 'Pay now'} <Arrow /></Link></div>
          )}
        </div>
      </section>
      {!(unpaid || rejected) && (
        <section aria-labelledby="next-h" className="ld-panel ld-s">
          <div className="ld-wrap">
            <article className="ld-opt">
              <div className="ld-wide2">
                <div className="grid gap-[18px]">
                  <div className="oh"><NextBadge batch={batch} /><div><h2 id="next-h">{batch?.name ?? s.course?.title ?? 'Our next batch'}</h2><p>{batch?.startDate ? `${s.daysToNext && s.daysToNext > 0 ? `Starts in ${s.daysToNext} days` : `Starts ${dateLong(istDate(batch.startDate))}`}` : 'Dates coming soon'}</p></div></div>
                  <Facts items={courseFacts(s, batch)} />
                </div>
                <div className="ld-buy">
                  <Price s={s} />
                  <Buy p={p} filled label={batch ? 'Join the next batch' : 'Join the program'} />
                  {p.syllabusHref && <a href={p.syllabusHref} className="ld-link"><Icon name="down" className="h-4 w-4" />Download the syllabus</a>}
                </div>
              </div>
            </article>
            {s.verified && s.runningBatch && (
              <p className="ld-note mt-5"><Icon name="info" className="mt-0.5 h-5 w-5 shrink-0" /><span><b>Already in the {s.runningBatch}?</b> We could not find {s.email} on its list. Log in with the email you gave at admission{p.whatsapp ? <>, or <a href={`${p.whatsapp.split('?')[0]}?text=${encodeURIComponent(`I am in the ${s.runningBatch}, please add my email ${s.email}`)}`} target="_blank" rel="noopener noreferrer">message us on WhatsApp</a> and we will add it</> : ''}.</span></p>
            )}
          </div>
        </section>
      )}
      <Program s={s} title="What you will learn" lead="Month by month." syllabusHref={p.syllabusHref} goal={p.goal} />
    </>
  )
}

export function NoCourseDashboard(p: JoinProps) {
  if (p.s.order && p.s.proof?.state === 'pending_review') return <Checking {...p} />
  if (p.s.listed) return <Listed {...p} />
  return <Join {...p} />
}
