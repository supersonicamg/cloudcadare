import Link from 'next/link'
import type { CSSProperties } from 'react'
import { Icon, type IconName } from '@educore/ui/marks'
import type { Enrolled } from '@/lib/dashboard'
import { KIND } from '@/lib/dashboard'
import { courseAbbr } from '@/lib/format'
import type { MyEnrollment } from '@/lib/learn'
import { isOpenNow } from '@/lib/live'
import { buttonLg, buttonOutline } from '@/lib/ui'
import { NextClassCard } from '../_components/live'

const ICON: Record<string, IconName> = { video: 'video', live: 'live', pdf: 'doc', document: 'doc', image: 'image', article: 'doc', quiz: 'quiz', test: 'quiz', download: 'down', external_link: 'link', lab: 'lab' }

/**
 * Home, for a learner whose batch is running. It answers four questions, in this order:
 *   1. What do I do now?         -> "Continue where you left off" (the one filled button; "Join" takes over while a class is open)
 *   2. When is my next class?    -> the next live class
 *   3. How am I doing?           -> progress against the batch, then the four months
 *   4. What else is due?         -> this week's list
 * Everything else lives on its own page (Lessons, Live classes, Notes), one tap away in the sidebar.
 */
export function EnrolledHome({ d, lead, first, joined, others }: { d: Enrolled; lead: MyEnrollment; first: string; joined: boolean; others: MyEnrollment[] }) {
  const { resume, upcoming, months } = d
  const base = `/learn/${lead.course.slug}`
  const finished = lead.status === 'completed'
  const started = lead.lessonsCompleted > 0 || (resume?.pct ?? 0) > 0
  const next = upcoming[0]
  const classOn = next ? isOpenNow(next, d.now) : false
  const month = months[d.currentMonth]
  const pct = Math.round(lead.progressPct)
  const behind = d.released === null ? null : d.released - lead.lessonsCompleted
  const batchAt = d.released === null || !lead.lessonsTotal ? null : Math.min(100, (d.released / lead.lessonsTotal) * 100)
  const doneInWeek = d.week.items.filter((i) => i.state === 'done').length
  const minutesLeft = resume?.durationSeconds && resume.pct > 0 ? Math.max(1, Math.round((resume.durationSeconds * (1 - resume.pct / 100)) / 60)) : null
  const resumeIcon: IconName = resume ? (resume.type === 'video' || resume.type === 'live' ? 'play' : ICON[resume.type] ?? 'doc') : 'play'

  return (
    <>
      <header className="lx-head">
        <div>
          <h1 className="lx-h1">{joined ? 'Welcome' : 'Hi'}, {first}</h1>
          <p className="lx-lede">{[d.batch?.name ?? lead.course.title, month ? `Month ${d.currentMonth + 1} of ${months.length}` : null].filter(Boolean).join(' · ')}</p>
        </div>
      </header>

      {joined && (
        <p role="status" className="lx-note good"><Icon name="check" /><span><b>You&apos;re in{d.batch ? ` the ${d.batch.name}` : ''}.</b> Your lessons and class recordings are open. There is nothing to pay.</span></p>
      )}

      <div className="lx-two">
        {resume ? (
          <section className="lx-card lx-resume" aria-labelledby="resume-h">
            <div>
              <p className="lx-k" id="resume-h">{finished ? 'Review' : started ? 'Continue where you left off' : 'Start here'}</p>
              <div className="lx-resume-body">
                <span className="lx-ico"><Icon name={resumeIcon} className={resumeIcon === 'play' ? 'fill' : undefined} /></span>
                <div className="min-w-0">
                  <h2>{resume.title}</h2>
                  <p className="lx-meta">{[KIND[resume.type] ?? 'Lesson', minutesLeft ? `${minutesLeft} min left` : resume.durationSeconds ? `${Math.max(1, Math.round(resume.durationSeconds / 60))} min` : null].filter(Boolean).join(' · ')}</p>
                </div>
              </div>
            </div>
            <div className="grid gap-4">
              {resume.pct > 0 && !resume.done && (
                <div className="lx-pct"><div className="lx-bar" role="progressbar" aria-valuenow={resume.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${resume.title} progress`}><i style={{ width: `${resume.pct}%` }} /></div><span aria-hidden="true">{resume.pct}% watched</span></div>
              )}
              <Link href={`${base}/${resume.id}`} className={`${classOn ? buttonOutline : buttonLg} max-[720px]:w-full`}>{finished ? 'Review from the start' : started ? 'Resume lesson' : 'Start learning'}<Icon name="chev" className="lx-i" /></Link>
            </div>
          </section>
        ) : (
          <section className="lx-empty"><b>Lessons are on their way</b><p>They appear here as soon as they are published.</p></section>
        )}
        {next ? <NextClassCard s={next} now={d.now} filled={classOn} /> : (
          <section className="lx-card lx-class" aria-label="Live classes">
            <div><p className="lx-k">Next live class</p><p className="lx-lede">No class is scheduled right now. New classes show up here as soon as they are set up.</p></div>
            <Link href={`${base}/live`} className={`${buttonOutline} max-[720px]:w-full`}>See recorded classes</Link>
          </section>
        )}
      </div>

      <div className="lx-two">
        <section className="lx-card" aria-labelledby="prog-h">
          <h2 className="sr-only" id="prog-h">Your progress</h2>
          <div className="lx-prog-top"><span className="lx-big">{pct}<small>%</small></span><p><b>of {courseAbbr(lead.course.title)} done</b>{lead.lessonsCompleted} of {lead.lessonsTotal} lessons</p></div>
          <div className={batchAt === null ? 'mt-5' : 'lx-pace'}>
            <div className="lx-bar" style={{ height: 10, borderRadius: 5 }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={batchAt === null ? 'Course progress' : `You have done ${lead.lessonsCompleted} lessons; ${d.released} are open to your batch`}><i style={{ width: `${pct}%` }} /></div>
            {batchAt !== null && <span className="mk" style={{ left: `${batchAt}%`, '--shift': batchAt > 85 ? '-100%' : batchAt < 15 ? '0%' : '-50%' } as CSSProperties} aria-hidden="true"><span>Batch: lesson {d.released}</span></span>}
          </div>
          {behind !== null && (
            <p className="lx-pacenote">{behind <= 2 ? <b>You are on track with your batch.</b> : <><b>{behind} lessons behind the batch.</b>{resume ? ` Finish “${resume.title}” next to catch up.` : ''}</>}</p>
          )}
          {d.stats.length > 0 && (
            <dl className="lx-stats" style={{ '--n': Math.min(d.stats.length, 4) } as CSSProperties}>
              {d.stats.map((s) => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}
            </dl>
          )}
          {months.length > 0 && (
            <ol className="lx-months" aria-label="Progress by month">
              {months.map((mo, i) => (
                <li key={mo.id} className={mo.state === 'now' ? 'now' : undefined}>
                  <Link href={`${base}/material?month=${mo.id}`}>
                    <span className="n">{mo.number}</span>
                    <span className="min-w-0"><span className="t">{mo.title}</span><span className="lx-bar thin" style={{ display: 'block' }} aria-hidden="true"><i style={{ width: `${mo.total ? (mo.done / mo.total) * 100 : 0}%` }} /></span></span>
                    <span className="c">{mo.state === 'locked' ? (mo.opensOn ? `Opens ${mo.opensOn}` : 'Locked') : `${mo.done} of ${mo.total}`}<span className="sr-only">, month {i + 1}</span></span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        {d.week.items.length > 0 && (
          <section className="lx-card" aria-labelledby="week-h">
            <div className="lx-sec-h" style={{ paddingBottom: 12 }}>
              <h2 className="lx-h2" id="week-h">{d.week.title}</h2>
              <span className="lx-meta">{doneInWeek > 0 ? `${doneInWeek} of ${d.week.items.length} done` : d.week.range}</span>
            </div>
            <ul className="lx-todo">
              {d.week.items.map((i) => (
                <li key={i.key} className={i.state === 'done' ? 'dn' : undefined}>
                  <span className={`lx-st${i.state === 'done' ? ' ok' : i.state === 'half' ? ' half' : ''}`}>{i.state === 'done' && <Icon name="check" />}<span className="sr-only">{i.state === 'done' ? 'Done' : i.state === 'half' ? 'Started' : 'To do'}</span></span>
                  <span><b>{i.title}</b><span className="d">{i.detail}</span></span>
                  {i.href ? <Link href={i.href} className="lx-link" aria-label={`${i.action}: ${i.title}`}>{i.action}</Link> : <span />}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {others.length > 0 && (
        <section className="lx-sec" aria-labelledby="other-h">
          <h2 className="lx-h2" id="other-h">Your other courses</h2>
          <div className="lx-rows">
            {others.map((e) => (
              <Link key={e.id} href={`/learn/${e.course.slug}/material`}>
                <span className="lx-ico"><Icon name="book" /></span>
                <span><b>{e.course.title}</b><span className="lx-meta">{e.status === 'completed' ? 'Completed' : `${e.lessonsCompleted} of ${e.lessonsTotal} lessons`}</span></span>
                <Icon name="chev" className="lx-i" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
