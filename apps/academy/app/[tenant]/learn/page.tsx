import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'
import { Icon, Logo, platformFor } from '@educore/ui/marks'
import { isEnabled } from '@educore/features'
import { requireMember } from '@/lib/dal'
import { clock } from '@/lib/clock'
import { courseAbbr, dateShort, nowMs, timeShort } from '@/lib/format'
import { getMyEnrollments, type MyEnrollment } from '@/lib/learn'
import { getMaterial, type MaterialLesson } from '@/lib/material'
import { getShell, TERMS } from '@/lib/shell'
import { bannerClass, buttonLg, buttonOutline, buttonQuiet } from '@/lib/ui'
import { Panel, StatusChip } from '../_components/parts'
import { dripDate, minutes, ProgressBar } from './_components/curriculum'
import { LearnerClimb, type ClimbMonth } from './_components/learner-climb'

export const metadata = { title: 'My learning' }

/*
 * B1 · My learning.
 * 1. One job: get back to the lesson. One filled button: "Resume lesson" (Start / Review in the other states).
 * 2. Reading order: welcome + three facts -> the lesson to resume -> where you are in the program (the climb, mist panel,
 *    the one allowed use) -> the next live class and latest recordings -> your latest notes + a person to ask.
 * 3. Never an empty dashboard: with no access, the page says where the order stands and the one next step.
 */

const KIND: Record<string, string> = { video: 'Video', live: 'Live recording', pdf: 'PDF', document: 'Document', image: 'Image', article: 'Reading', quiz: 'Quiz', download: 'Download', external_link: 'Link' }
const kindLine = (l: MaterialLesson) => [KIND[l.type] ?? l.type, l.type === 'quiz' ? null : minutes(l.durationSeconds)].filter(Boolean).join(' · ')
const dayName = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })

async function PaidBanner({ searchParams }: { searchParams: PageProps<'/[tenant]/learn'>['searchParams'] }) {
  const { paid } = await searchParams
  if (!paid) return null
  return (
    <p role="status" className={`${bannerClass('ok')} mx-auto mt-6 max-w-[1280px]`}>
      <Icon name="check" className="h-[22px] w-[22px] shrink-0" />
      <span>Payment received. Your course is ready, and your receipt is in <Link href="/account/payments" className="underline">Payments and receipts</Link>.</span>
    </p>
  )
}

const wrap = 'mx-auto max-w-[1280px] px-[clamp(16px,5vw,72px)]'

/** No access yet: where the order stands, and the one thing to do. */
async function NoAccess({ a }: { a: Awaited<ReturnType<typeof requireMember>> }) {
  const { data: order } = await a.db.from('orders').select('id, status, order_no').eq('member_id', a.memberId).in('status', ['awaiting_payment', 'partially_paid']).order('placed_at', { ascending: false }).limit(1).maybeSingle()
  const { data: proof } = order ? await a.db.from('payment_proofs').select('id').eq('order_id', order.id).eq('state', 'pending_review').maybeSingle() : { data: null }
  const s = proof && order
    ? { title: 'We are checking your payment', text: `Order ${order.order_no}. Your course opens as soon as we see it.`, cta: 'See where it stands', href: `/checkout/${order.id}/pending` }
    : order
      ? { title: 'Your order is waiting for payment', text: `Order ${order.order_no}. Pay by UPI and your course opens once we check it.`, cta: 'Pay now', href: `/checkout/${order.id}` }
      : { title: `You are not enrolled in a ${TERMS.course.toLowerCase()} yet`, text: 'Join the next batch to open the lessons, live classes and recordings.', cta: 'Join the next batch', href: '/courses' }
  return (
    <div className="grid items-center gap-6 rounded-[28px] bg-muted p-6 md:grid-cols-[1fr_auto] md:p-10">
      <div className="grid gap-2"><h2 className="t-section">{s.title}</h2><p className="t-lead">{s.text}</p></div>
      <Link href={s.href} className={buttonLg}>{s.cta} <span aria-hidden="true">→</span></Link>
    </div>
  )
}

export default async function MyLearning(props: PageProps<'/[tenant]/learn'>) {
  const a = await requireMember('/learn')
  const now = nowMs()
  const [{ theme, brand, nav, account, site, bundle }, enrollments] = await Promise.all([getShell(), getMyEnrollments(a)])
  const lead: MyEnrollment | undefined = enrollments.find((e) => e.status === 'active') ?? enrollments[0]
  const others = enrollments.filter((e) => e !== lead)
  const certs = isEnabled(bundle.features, 'learning.certificates')
  const notesOn = isEnabled(bundle.features, 'learning.notes')
  const m = lead ? await getMaterial(a, lead.course.slug, now) : null
  const first = (a.memberName || '').split(/\s+/)[0] || 'there'

  let body: ReactNode
  if (!lead || !m) {
    body = <NoAccess a={a} />
  } else {
    const { course, months } = m
    const resume = course.resume ? m.all.find((l) => l.id === course.resume!.id) ?? null : null
    const finished = lead.status === 'completed'
    const currentIdx = Math.max(0, months.findIndex((mo) => mo.lessons.some((l) => l.id === resume?.id)))
    const climb: ClimbMonth[] = months.map((mo, i) => {
      const locks = mo.lessons.filter((l) => l.lock?.unlocksAt)
      const allLocked = mo.lessons.length > 0 && mo.lessons.every((l) => l.lock)
      const opens = allLocked ? locks.map((l) => l.lock!.unlocksAt!).sort()[0] : null
      return {
        title: mo.title, number: String(i + 1).padStart(2, '0'), done: mo.done, total: mo.lessons.length,
        notes: mo.lessons.reduce((n, l) => n + l.noteCount, 0), opensOn: opens ? dripDate(opens) : null,
        next: mo.lessons.filter((l) => !l.done && !l.lock).slice(0, 3).map((l) => ({ id: l.id, title: l.title, kind: kindLine(l), isNew: l.isNew })),
      }
    })

    const sessions = await a.db.from('live_sessions').select('id, title, starts_at, ends_at, status').or(`course_id.eq.${lead.course.id},course_id.is.null`)
      .neq('status', 'cancelled').neq('status', 'completed').gte('ends_at', new Date(now).toISOString()).order('starts_at').limit(1)
    const next = sessions.data?.[0]
    const recordings = m.all.filter((l) => l.type === 'live' && !l.lock).sort((x, y) => (y.publishedAt ?? '').localeCompare(x.publishedAt ?? '')).slice(0, 3)
    const latestNotes = m.notes.slice(0, 3)
    const lessonOf = new Map(m.all.map((l) => [l.id, l]))
    const help = (brand.contact?.whatsapp ?? '').replace(/\D/g, '')
    const cta = finished ? 'Review from the start' : lead.lessonsCompleted > 0 || lead.lastLessonId ? 'Resume lesson' : 'Start learning'
    const logo = platformFor(lead.course.title)

    body = (
      <>
        <section aria-labelledby="home-h" className={`${wrap} grid gap-6 pb-10 pt-8 md:pt-12`}>
          <div className="grid gap-4">
            <h1 id="home-h" className="t-title">Welcome back, <span className="text-primary">{first}</span></h1>
            <ul className="flex flex-wrap gap-x-7 gap-y-2 t-label !text-fg">
              <li className="flex items-center gap-2"><Icon name="flag" className="h-5 w-5 text-primary" />Month {currentIdx + 1} of {months.length}</li>
              <li className="flex items-center gap-2"><Icon name="check" className="h-5 w-5 text-primary" /><span className="tnum">{lead.lessonsCompleted} of {lead.lessonsTotal} lessons done</span></li>
              {next && <li className="flex items-center gap-2"><Icon name="calendar" className="h-5 w-5 text-primary" /><span className="tnum">Next live class: {dayName.format(new Date(next.starts_at))} {dateShort(next.starts_at)}, {timeShort(next.starts_at)}</span></li>}
            </ul>
          </div>
          {resume ? (
            <div className="grid items-center gap-x-7 gap-y-5 rounded-[24px] border-2 border-fg p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:p-6">
              <span className="grid h-[96px] w-[96px] place-items-center rounded-2xl bg-[#E4EFEB] text-deep max-sm:h-16 max-sm:w-16">
                {resume.type === 'video' || resume.type === 'live' ? <Icon name="play" className="h-9 w-9" /> : logo ? <Logo name={logo} className="h-10 w-10" /> : <Icon name={resume.type === 'quiz' ? 'quiz' : 'doc'} className="h-9 w-9" />}
              </span>
              <div className="grid min-w-0 gap-1.5">
                <p className="t-label !text-primary">{finished ? 'Review' : lead.lessonsCompleted > 0 ? 'Continue' : 'Start here'} · {courseAbbr(lead.course.title)}</p>
                <h2 className="t-section">{resume.title}</h2>
                <p className="t-small">{kindLine(resume)}{resume.noteCount ? ` · ${resume.noteCount} ${resume.noteCount === 1 ? 'note' : 'notes'}` : ''}</p>
                {resume.pct > 0 && !resume.done && <ProgressBar pct={resume.pct} label={`${resume.title} watched`} className="!h-2 max-w-[420px]" />}
              </div>
              <Link href={`/learn/${lead.course.slug}/${resume.id}`} className={`${buttonLg} max-sm:w-full`}>{cta} <span aria-hidden="true">→</span></Link>
            </div>
          ) : (
            <p className="t-body rounded-2xl bg-muted p-5 !text-fg">Lessons will appear here once they are published.</p>
          )}
        </section>

        {climb.length > 0 && (
          <section aria-labelledby="climb-h" className="px-[clamp(10px,1.6vw,24px)] pb-10">
            <div className="mx-auto max-w-[1280px] rounded-[clamp(22px,2.6vw,36px)] bg-[#E4EFEB] p-5 sm:p-9">
              <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
                <div className="grid gap-1"><h2 id="climb-h" className="t-section">Where you are in {courseAbbr(lead.course.title)}</h2><p className="t-lead">Month {currentIdx + 1} of {climb.length}. Later months open on their week.</p></div>
                <Link href={`/learn/${lead.course.slug}/material`} className="t-label font-semibold !text-primary underline-offset-4 hover:underline">Open course material <span aria-hidden="true">→</span></Link>
              </div>
              <LearnerClimb months={climb} current={currentIdx} slug={lead.course.slug} goal={lead.course.title.length > 24 ? 'Program done' : lead.course.title} />
            </div>
          </section>
        )}

        <section aria-labelledby="live-h" className={`${wrap} grid gap-5 pb-12`}>
          <div className="flex flex-wrap items-end justify-between gap-3"><h2 id="live-h" className="t-section">Live classes</h2><Link href={`/learn/${lead.course.slug}/live`} className="t-label font-semibold !text-primary underline-offset-4 hover:underline">All live classes and recordings <span aria-hidden="true">→</span></Link></div>
          {next ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[20px] border-2 border-fg p-4 sm:p-5">
              <StatusChip tone="wait">Next live class</StatusChip>
              <b className="t-card min-w-0 flex-1">{next.title}</b>
              <span className="t-label tnum !text-fg">{dayName.format(new Date(next.starts_at))} {dateShort(next.starts_at)} · {timeShort(next.starts_at)} to {timeShort(next.ends_at)}</span>
            </div>
          ) : <p className="t-body">No live class is scheduled right now.</p>}
          {recordings.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-3">
              {recordings.map((l) => (
                <li key={l.id}>
                  <Link href={`/learn/${lead.course.slug}/${l.id}`} className="grid h-full content-start gap-1.5 rounded-[18px] bg-muted p-4 hover:bg-[#EBEBE7]">
                    <span className="flex items-center gap-2 t-small"><Icon name="play" className="h-4 w-4 text-primary" />Recording{l.durationSeconds ? ` · ${minutes(l.durationSeconds)}` : ''}</span>
                    <b className="t-card">{l.title}</b>
                    {l.pct > 0 && !l.done && <ProgressBar pct={l.pct} label={`${l.title} watched`} className="!h-1.5" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="notes-h" className="px-[clamp(10px,1.6vw,24px)] pb-14">
          <Panel className="mx-auto grid max-w-[1280px] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="grid gap-4">
              <div className="flex flex-wrap items-end justify-between gap-3"><h2 id="notes-h" className="t-section">Your latest notes</h2>{notesOn && <Link href="/learn/notes" className="t-label font-semibold !text-primary underline-offset-4 hover:underline">All my notes <span aria-hidden="true">→</span></Link>}</div>
              {latestNotes.length ? (
                <ul className="grid gap-3">
                  {latestNotes.map((n) => {
                    const l = lessonOf.get(n.lessonId)
                    const at = n.positionSeconds !== null ? `?t=${n.positionSeconds}` : n.pageNo !== null ? `?page=${n.pageNo}` : ''
                    return (
                      <li key={n.id}>
                        <Link href={`/learn/${lead.course.slug}/${n.lessonId}${at}`} className="grid gap-1 rounded-2xl bg-white p-4 hover:shadow-[0_8px_24px_rgba(20,32,31,.10)]">
                          <span className="t-label tnum !text-primary">{l?.title ?? 'Lesson'}{n.positionSeconds !== null ? ` · ${clock(n.positionSeconds)}` : n.pageNo !== null ? ` · page ${n.pageNo}` : ''}</span>
                          <span className="t-body line-clamp-2 !text-fg">{n.body || 'Bookmark'}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : <p className="t-body">{notesOn ? 'Press N while a lesson plays to write your first note.' : 'Notes are not switched on for this academy.'}</p>}
            </div>
            <aside className="grid gap-3 rounded-[20px] bg-white p-5" aria-label="Ask a person">
              <b className="t-card">Stuck on something?</b>
              <p className="t-body">Ask us. A real person answers.</p>
              {help.length >= 8
                ? <a href={`https://wa.me/${help}`} target="_blank" rel="noopener noreferrer" className={buttonOutline}>Message us on WhatsApp</a>
                : <Link href="/account" className={buttonOutline}>Update my contact details</Link>}
            </aside>
          </Panel>
        </section>

        {others.length > 0 && (
          <section aria-labelledby="oth-h" className={`${wrap} pb-16`}>
            <h2 id="oth-h" className="t-label mb-2 !text-mute">Other {TERMS.courses.toLowerCase()}</h2>
            <ul className="border-t-2 border-fg">
              {others.map((e) => (
                <li key={e.id} className="grid items-center gap-x-5 gap-y-2 border-b border-border py-5 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="grid gap-1.5">
                    <b className="t-card">{e.course.title}</b>
                    <ProgressBar pct={e.progressPct} label={`${e.course.title} progress`} className="!h-2 max-w-[320px]" />
                    <p className="t-small tnum">{e.status === 'completed' ? 'Completed' : `${e.lessonsCompleted} of ${e.lessonsTotal} lessons`} · {Math.round(e.progressPct)}%{e.status === 'completed' && certs && <> · <Link href="/certificates" className="font-semibold text-primary underline">View certificate</Link></>}</p>
                  </div>
                  <Link href={`/learn/${e.course.slug}/material`} className={`${buttonQuiet} justify-self-start`}>{e.status === 'completed' ? 'Review' : 'Open'}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
    )
  }

  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <main>
        <Suspense fallback={null}><PaidBanner searchParams={props.searchParams} /></Suspense>
        {!lead || !m ? (
          <section aria-labelledby="home-h" className={`${wrap} grid gap-6 pb-20 pt-8 md:pt-12`}>
            <h1 id="home-h" className="t-title">My learning</h1>
            {body}
          </section>
        ) : body}
      </main>
    </theme.SiteLayout>
  )
}
