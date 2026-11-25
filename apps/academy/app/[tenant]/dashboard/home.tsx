import Link from 'next/link'
import { Icon, type IconName } from '@educore/ui/marks'
import type { Enrolled } from '@/lib/dashboard'
import { KIND } from '@/lib/dashboard'
import { courseAbbr } from '@/lib/format'
import type { MyEnrollment } from '@/lib/learn'
import { isOpenNow } from '@/lib/live'
import { buttonLg, buttonOutline } from '@/lib/ui'
import { NextClassCard } from '../_components/live'
import { MonthClimb, type ClimbLesson, type ClimbMonth } from './month-climb'

const ICON: Record<string, IconName> = { video: 'video', live: 'live', pdf: 'doc', document: 'doc', image: 'image', article: 'book', quiz: 'quiz', test: 'quiz', download: 'down', external_link: 'link', lab: 'lab' }

/** "Good morning" for a clock in India. */
function greeting(now: number) {
  const h = new Date(now + 5.5 * 3_600_000).getUTCHours()
  return h < 5 ? 'Hello' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Hello'
}

/** What the climb shows for each month: the next few lessons, in reading order, open ones first. */
function climbMonths(d: Enrolled): ClimbMonth[] {
  return d.m.months.map((mo, i) => {
    const info = d.months[i]!
    const todo = mo.lessons.filter((l) => !l.done)
    const ordered = [...todo.filter((l) => !l.lock), ...todo.filter((l) => l.lock)]
    const next = ordered.slice(0, 4).map<ClimbLesson>((l) => ({
      id: l.id, title: l.title, icon: ICON[l.type] ?? 'doc', kind: KIND[l.type] ?? 'Lesson',
      state: l.lock ? 'locked' : l.pct > 0 ? 'half' : 'todo',
      fact: l.lock ? (l.lock.unlocksAt ? `Opens ${new Date(l.lock.unlocksAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Finish earlier ones') : l.pct > 0 ? `${l.pct}% done` : l.isNew ? 'New' : l.durationSeconds ? `${Math.max(1, Math.round(l.durationSeconds / 60))} min` : '',
    }))
    return { id: mo.id, number: info.number, title: info.title, done: info.done, total: info.total, state: info.state, opensOn: info.opensOn, next, more: Math.max(0, mo.lessons.length - next.length) }
  })
}

/**
 * Home, for a learner whose batch is running. It answers three questions, in this order, and nothing else:
 *   1. What do I do now?        -> the Continue card (the one filled button; "Join" takes over while a class is open)
 *   2. When is my next class?   -> the next live class
 *   3. Where am I in the course? -> the climb: four months, the one I am in open, what is next in it
 * Everything else (every lesson, class recordings, notes) is one tap away in the menu.
 */
export function EnrolledHome({ d, lead, first, joined, others, goal }: { d: Enrolled; lead: MyEnrollment; first: string; joined: boolean; others: MyEnrollment[]; goal?: string }) {
  const { resume, upcoming, months } = d
  const base = `/learn/${lead.course.slug}`
  const finished = lead.status === 'completed'
  const started = lead.lessonsCompleted > 0 || (resume?.pct ?? 0) > 0
  const next = upcoming[0]
  const classOn = next ? isOpenNow(next, d.now) : false
  const pct = Math.round(lead.progressPct)
  const behind = d.released === null ? null : d.released - lead.lessonsCompleted
  const minutesLeft = resume?.durationSeconds && resume.pct > 0 ? Math.max(1, Math.round((resume.durationSeconds * (1 - resume.pct / 100)) / 60)) : null
  const resumeIcon: IconName = resume ? (resume.type === 'video' || resume.type === 'live' ? 'play' : ICON[resume.type] ?? 'doc') : 'play'
  const resumeMonth = resume ? d.m.months.findIndex((mo) => mo.lessons.some((l) => l.id === resume.id)) : -1

  return (
    <>
      <header className="lx-head">
        <div>
          <h1 className="lx-h1">{joined ? 'Welcome' : greeting(d.now)}, {first}</h1>
          <p className="lx-lede">{[d.batch?.name ?? lead.course.title, months.length ? `Month ${d.currentMonth + 1} of ${months.length}` : null].filter(Boolean).join(' · ')}</p>
        </div>
      </header>

      {joined && (
        <p role="status" className="lx-note good"><Icon name="check" /><span><b>You&apos;re in{d.batch ? ` the ${d.batch.name}` : ''}.</b> Your lessons and class recordings are open. There is nothing to pay.</span></p>
      )}

      <div className="lx-two">
        {resume ? (
          <section className="lx-cont" aria-labelledby="resume-h">
            <div className={`lx-cont-pic${resume.type === 'video' || resume.type === 'live' ? ' play' : ''}`} aria-hidden="true">
              <span className="m">{resumeMonth >= 0 ? `Month ${resumeMonth + 1}` : 'Lesson'}</span>
              <span className="b"><Icon name={resumeIcon} className={resumeIcon === 'play' ? 'fill' : undefined} /></span>
              {resume.pct > 0 && !resume.done && <span className="w"><i style={{ width: `${resume.pct}%` }} /></span>}
            </div>
            <div className="lx-cont-body">
              <p className="lx-k" id="resume-h">{finished ? 'Review' : started ? 'Continue where you left off' : 'Start here'}</p>
              <h2>{resume.title}</h2>
              <p className="lx-meta">{[KIND[resume.type] ?? 'Lesson', minutesLeft ? `${minutesLeft} min left` : resume.durationSeconds ? `${Math.max(1, Math.round(resume.durationSeconds / 60))} min` : null].filter(Boolean).join(' · ')}</p>
              {behind !== null && !finished && (
                <p className="lx-pacechip">
                  {behind <= 2 ? <><Icon name="check" className="lx-i" />You are on track with your batch.</> : <><Icon name="info" className="lx-i" />You are {behind} lessons behind your batch. This one helps you catch up.</>}
                </p>
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

      {months.length > 0 && (
        <section className="lx-sec" aria-labelledby="climb-h">
          <div className="lx-sec-h">
            <h2 className="lx-h2" id="climb-h">Your {months.length} months</h2>
            <span className="lx-meta"><b>{pct}%</b> of {courseAbbr(lead.course.title)} done · {lead.lessonsCompleted} of {lead.lessonsTotal} lessons</span>
          </div>
          <MonthClimb months={climbMonths(d)} slug={lead.course.slug} goal={goal} label="Months of the program" />
        </section>
      )}

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
