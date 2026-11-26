import Link from 'next/link'
import type { Enrolled } from '@/lib/dashboard'
import { KIND } from '@/lib/dashboard'
import { courseAbbr, dateShort } from '@/lib/format'
import type { MyEnrollment } from '@/lib/learn'
import { isOpenNow } from '@/lib/live'
import { NextClassCard } from '../_components/live'
import { Ic, type IconName } from '../_components/v11'
import { LESSON_ICON, MonthCards, type MonthCardData } from './parts'

/** "Good morning" for a clock in India. */
function greeting(now: number) {
  const h = new Date(now + 5.5 * 3_600_000).getUTCHours()
  return h < 5 ? 'Hello' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Hello'
}

const minutes = (seconds: number) => Math.max(1, Math.round(seconds / 60))

/** What the "Next in Month N" list shows: the next few lessons of the month you are in, open ones first. */
function nextIn(d: Enrolled) {
  const mo = d.m.months[d.currentMonth]
  if (!mo) return null
  const todo = mo.lessons.filter((l) => !l.done)
  const ordered = [...todo.filter((l) => !l.lock), ...todo.filter((l) => l.lock)].slice(0, 3)
  return ordered.length ? { month: mo, info: d.months[d.currentMonth]!, lessons: ordered } : null
}

/** The four months as cards: your own progress on each. */
function monthCards(d: Enrolled, slug: string): MonthCardData[] {
  return d.months.map((m) => ({
    id: m.id, title: m.title, state: m.state,
    href: `/learn/${slug}/material?month=${m.id}`,
    note: m.state === 'done' ? 'finished' : m.state === 'now' ? 'you are here' : m.state === 'locked' ? (m.opensOn ? `opens ${m.opensOn}` : 'not open yet') : undefined,
    pct: m.total ? Math.round((m.done / m.total) * 100) : 0,
    line: m.state === 'done' ? `All ${m.total} lessons done` : m.state === 'locked' ? `${m.total} ${m.total === 1 ? 'lesson' : 'lessons'}` : `${m.done} of ${m.total} done`,
  }))
}

/**
 * Home, for a learner whose batch is running. It answers three questions, in this order, and nothing else:
 *   1. What do I do now?         -> the Continue block (the one filled button; "Join" takes over while a class is open)
 *   2. When is my next class?    -> the next live class
 *   3. Where am I in the course? -> your months, and what is next in the one you are in
 * Everything else (every lesson, class recordings, notes) is one tap away in the menu.
 */
export function EnrolledHome({ d, lead, first, joined, others }: { d: Enrolled; lead: MyEnrollment; first: string; joined: boolean; others: MyEnrollment[] }) {
  const { resume, upcoming, months } = d
  const base = `/learn/${lead.course.slug}`
  const finished = lead.status === 'completed'
  const started = lead.lessonsCompleted > 0 || (resume?.pct ?? 0) > 0
  const next = upcoming[0]
  const classOn = next ? isOpenNow(next, d.now) : false
  const pct = Math.round(lead.progressPct)
  const behind = d.released === null ? null : d.released - lead.lessonsCompleted
  const minutesLeft = resume?.durationSeconds && resume.pct > 0 ? Math.max(1, Math.round((resume.durationSeconds * (1 - resume.pct / 100)) / 60)) : null
  const resumeIcon: IconName = resume ? (resume.type === 'video' || resume.type === 'live' ? 'play' : LESSON_ICON[resume.type] ?? 'doc') : 'play'
  const resumeMonth = resume ? d.m.months.findIndex((mo) => mo.lessons.some((l) => l.id === resume.id)) : -1
  // Where this lesson sits in the whole program. The picture says "Lesson 3 of 20" so it never repeats a month card's drawing.
  const allLessons = d.m.months.flatMap((mo) => mo.lessons)
  const resumeAt = resume ? allLessons.findIndex((l) => l.id === resume.id) + 1 : 0
  const upNext = nextIn(d)

  return (
    <>
      <div className="pg-h">
        <div>
          <h1 className="t-title">{joined ? 'Welcome' : greeting(d.now)}, {first}</h1>
          <p className="t-lead">{[d.batch?.name ?? lead.course.title, months.length ? `Month ${d.currentMonth + 1} of ${months.length}` : null].filter(Boolean).join(' · ')}</p>
        </div>
      </div>

      {joined && (
        <p role="status" className="note-l top"><Ic n="check" /><span><b>You&apos;re in{d.batch ? ` the ${d.batch.name}` : ''}.</b> Your lessons and class recordings are open. There is nothing to pay.</span></p>
      )}

      <div className="home-top">
        {resume ? (
          <section className="cont dark" aria-labelledby="cont-k">
            <div className="cont-pic">
              {resumeAt > 0 && (
                <p className="cont-n">
                  <span className="t-label">{resumeMonth >= 0 ? `Month ${resumeMonth + 1}` : 'Lesson'}</span>
                  <span className="t-num">Lesson {resumeAt}<small>of {allLessons.length}</small></span>
                </p>
              )}
              <span className="play" aria-hidden="true"><Ic n={resumeIcon} /></span>
              {resume.pct > 0 && !resume.done && <span className="wp" aria-hidden="true"><i style={{ width: `${resume.pct}%` }} /></span>}
            </div>
            <div className="cont-b">
              <p className="t-label" id="cont-k">{finished ? 'Review' : started ? 'Continue where you left off' : 'Start here'}</p>
              <h2 className="t-h3">{resume.title}</h2>
              <p className="t-small">{[KIND[resume.type] ?? 'Lesson', minutesLeft ? `${minutesLeft} min left` : resume.durationSeconds ? `${minutes(resume.durationSeconds)} min` : null, resumeMonth >= 0 ? `Month ${resumeMonth + 1}` : null].filter(Boolean).join(' · ')}</p>
              {behind !== null && !finished && (
                <p className="pace">
                  {behind <= 2 ? <><Ic n="check" s />You are on track with your batch.</> : <><Ic n="info" s />You are {behind} lessons behind your batch. This one helps you catch up.</>}
                </p>
              )}
              <div className="acts-c">
                <Link href={`${base}/${resume.id}`} className={classOn ? 'btn btn-line' : 'btn'}>{finished ? 'Review from the start' : started ? 'Resume lesson' : 'Start learning'}</Link>
              </div>
            </div>
          </section>
        ) : (
          <section className="card nada" aria-labelledby="cont-k">
            <p className="t-card" id="cont-k">Lessons are on their way</p>
            <p className="t-small">They appear here as soon as they are published.</p>
          </section>
        )}
        {next ? <NextClassCard s={next} now={d.now} /> : (
          <section className="card ncls" aria-labelledby="ncls-k">
            <p className="t-label" id="ncls-k">Next live class</p>
            <p className="t-small">No class is scheduled right now. New classes show up here as soon as they are set up.</p>
            <div className="foot"><Link className="btn btn-line btn-sm btn-full" href={`${base}/live`}>See recorded classes</Link></div>
          </section>
        )}
      </div>

      {months.length > 0 && (
        <section className="blk" aria-labelledby="mo-h">
          <div className="blk-h">
            <h2 className="t-h3" id="mo-h">Your {months.length} months</h2>
            <p className="t-small"><b>{pct}%</b> of {courseAbbr(lead.course.title)} done · {lead.lessonsCompleted} of {lead.lessonsTotal} lessons</p>
          </div>
          <MonthCards months={monthCards(d, lead.course.slug)} />

          {upNext && (
            <div className="nextin">
              <div className="blk-h">
                <h3 className="t-card">Next in Month {d.currentMonth + 1}</h3>
                <Link className="link link-s" href={`${base}/material?month=${upNext.month.id}`}>See all {upNext.info.total} lessons</Link>
              </div>
              <ul className="rows">
                {upNext.lessons.map((l) => {
                  const kind = [KIND[l.type] ?? 'Lesson', l.durationSeconds ? `${minutes(l.durationSeconds)} min` : null].filter(Boolean).join(' · ')
                  const icon = LESSON_ICON[l.type] ?? 'doc'
                  if (l.lock) {
                    return (
                      <li key={l.id}>
                        <div className="row locked">
                          <span className="ti lock"><Ic n="lock" /></span>
                          <span className="tx"><b>{l.title}</b><span>{kind}</span></span>
                          <span className="rt">{l.lock.unlocksAt ? `Opens ${dateShort(l.lock.unlocksAt)}` : 'Finish earlier ones'}</span>
                        </div>
                      </li>
                    )
                  }
                  return (
                    <li key={l.id}>
                      <Link className="row" href={`${base}/${l.id}`}>
                        <span className={`ti${l.pct > 0 ? ' half' : ''}`}><Ic n={icon} /></span>
                        <span className="tx"><b>{l.title}</b><span>{kind}</span></span>
                        <span className="rt">{l.pct > 0 ? <b>{l.pct}% done</b> : l.isNew ? <b>New</b> : null}<Ic n="chev" className="go" /></span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      {others.length > 0 && (
        <section className="blk" aria-labelledby="other-h">
          <div className="blk-h"><h2 className="t-h3" id="other-h">Your other courses</h2></div>
          <ul className="rows">
            {others.map((e) => (
              <li key={e.id}>
                <Link className="row" href={`/learn/${e.course.slug}/material`}>
                  <span className="ti"><Ic n="book" /></span>
                  <span className="tx"><b>{e.course.title}</b><span>{e.status === 'completed' ? 'Completed' : `${e.lessonsCompleted} of ${e.lessonsTotal} lessons`}</span></span>
                  <span className="rt"><Ic n="chev" className="go" /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
