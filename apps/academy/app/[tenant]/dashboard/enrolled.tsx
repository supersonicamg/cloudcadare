import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { Icon, type IconName } from '@educore/ui/marks'
import type { Enrolled } from '@/lib/dashboard'
import { KIND } from '@/lib/dashboard'
import { courseAbbr, dateShort } from '@/lib/format'
import type { MyEnrollment } from '@/lib/learn'
import { isOpenNow } from '@/lib/live'
import { groupOf, type Group } from '@/lib/material'
import { buttonLg, buttonLine, buttonOutline } from '@/lib/ui'
import { PendingRecording, RecordingCard, ScheduledClasses, recordingsOf } from '../_components/live'
import { Climb } from './climb'

export interface Extras {
  notes: boolean
  certificates: boolean
  syllabusHref?: string
  /** The flag on the last step of the climb, e.g. "Cloud architect". */
  goal?: string
  whatsapp: string | null
  others: MyEnrollment[]
}

const ICON: Record<string, IconName> = { video: 'video', live: 'live', pdf: 'doc', document: 'doc', image: 'image', article: 'doc', quiz: 'quiz', test: 'quiz', download: 'down', external_link: 'link', lab: 'lab' }
const Arrow = () => <span aria-hidden="true">→</span>
const More = ({ href, children }: { href: string; children: ReactNode }) => <Link href={href} className="ld-link">{children} <Arrow /></Link>

/**
 * The dashboard of a learner whose batch is running (plan/16 §12, E1 and E2).
 * Reading order: greeting -> the lesson to resume (the one filled button) -> progress against the batch -> live classes
 * (scheduled, then recorded) -> the program by month -> study material -> certificate and a person to ask.
 * While a class is open, "Join on Teams" is the filled button and the resume button steps back to an outline.
 */
export function EnrolledDashboard({ d, lead, first, joined, x }: { d: Enrolled; lead: MyEnrollment; first: string; joined: boolean; x: Extras }) {
  const { m, resume, upcoming, months } = d
  const slug = lead.course.slug
  const abbr = courseAbbr(lead.course.title)
  const base = `/learn/${slug}`
  const finished = lead.status === 'completed'
  const started = lead.lessonsCompleted > 0 || (resume?.pct ?? 0) > 0
  const classOn = upcoming[0] ? isOpenNow(upcoming[0], d.now) : false
  const month = months[d.currentMonth]
  const recordings = recordingsOf(m.all, d.sessions, d.now)
  const ready = recordings.filter((r) => r.lesson.recording !== 'none').length
  const waiting = d.sessions.filter((s) => s.status === 'completed' && !s.lessonId && d.now - new Date(s.endsAt).getTime() < 7 * 86_400_000)
  const shown = [...waiting.slice(-1), ...recordings].slice(0, 3)
  const pct = Math.round(lead.progressPct)
  const behind = d.released === null ? null : d.released - lead.lessonsCompleted
  const batchAt = d.released === null || !lead.lessonsTotal ? null : Math.min(100, (d.released / lead.lessonsTotal) * 100)
  const doneInWeek = d.week.items.filter((i) => i.state === 'done').length
  const minutesLeft = resume?.durationSeconds && resume.pct > 0 ? Math.max(1, Math.round((resume.durationSeconds * (1 - resume.pct / 100)) / 60)) : null

  const count = (g: Group) => m.all.filter((l) => groupOf(l.type) === g)
  const material = ([
    ['video', 'video', 'Videos'], ['live', 'live', 'Class recordings'], ['pdf', 'doc', 'PDFs and slides'], ['image', 'image', 'Images'],
  ] as Array<[Group, IconName, string]>).map(([g, icon, label]) => {
    const all = count(g)
    return { key: g, icon, label, n: all.length, fresh: all.filter((l) => l.isNew && !l.lock).length, href: g === 'live' ? `${base}/live` : `${base}/material?type=${g}` }
  }).filter((t) => t.n > 0)
  const recent = m.all.filter((l) => !l.lock && l.publishedAt).sort((a, b) => b.publishedAt!.localeCompare(a.publishedAt!)).slice(0, 3)
  const requirements = [
    { done: lead.lessonsTotal > 0 && lead.lessonsCompleted >= lead.lessonsTotal, label: `Finish all ${lead.lessonsTotal} lessons`, state: `${lead.lessonsCompleted} done` },
    ...(d.tests.total ? [{ done: d.tests.done === d.tests.total, label: `Pass the ${d.tests.total} ${d.tests.total === 1 ? 'test' : 'tests'}`, state: `${d.tests.done} passed` }] : []),
  ]
  const nextLocked = months.find((mo) => mo.state === 'locked' && mo.opensOn)

  return (
    <>
      <section aria-labelledby="dash-h" className="ld-s tight">
        <div className="ld-wrap ld-stack">
          {joined && (
            <p role="status" className="ld-note good"><Icon name="check" className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span><b>You&apos;re in{d.batch ? ` the ${d.batch.name}` : ''}.</b> Your lessons and class recordings are open. There is nothing to pay.</span></p>
          )}
          <div className="ld-hi">
            <h1 id="dash-h" className="ld-h1">{joined ? 'Welcome' : 'Welcome back'}, {first}</h1>
            <p className="ld-meta">{[d.batch?.name ?? lead.course.title, month ? `Month ${d.currentMonth + 1} of ${months.length}` : null].filter(Boolean).join(' · ')}</p>
          </div>
          {resume ? (
            <div className="ld-cont">
              <span className="ld-thumb"><Icon name={resume.type === 'video' || resume.type === 'live' ? 'play' : ICON[resume.type] ?? 'doc'} />{resume.pct > 0 && <span className="wp"><i style={{ width: `${resume.pct}%` }} /></span>}</span>
              <div className="body">
                <span className="k">{finished ? 'Review' : started ? 'Continue where you left off' : 'Start here'}</span>
                <h2>{resume.title}</h2>
                <p className="sub">{[KIND[resume.type] ?? 'Lesson', minutesLeft ? `${minutesLeft} minutes left` : resume.durationSeconds ? `${Math.max(1, Math.round(resume.durationSeconds / 60))} min` : null].filter(Boolean).join(' · ')}</p>
                {resume.pct > 0 && !resume.done && (
                  <div className="ld-prog"><div className="ld-bar" role="progressbar" aria-valuenow={resume.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${resume.title} progress`}><i style={{ width: `${resume.pct}%` }} /></div><span aria-hidden="true">{resume.pct}% done</span></div>
                )}
              </div>
              <Link href={`${base}/${resume.id}`} className={`${classOn ? buttonLine : buttonLg} max-[820px]:w-full`}>{finished ? 'Review from the start' : started ? 'Resume lesson' : 'Start learning'} <Arrow /></Link>
            </div>
          ) : <p className="ld-empty">Lessons will appear here once they are published.</p>}
        </div>
      </section>

      <section aria-labelledby="prog-h" className="ld-panel ld-s">
        <div className="ld-wrap">
          <div className="ld-head"><h2 id="prog-h" className="ld-h2">Your progress</h2><More href={`${base}/material`}>See every lesson</More></div>
          <div className={d.week.items.length ? 'ld-2' : 'grid'}>
            <div className="ld-card ld-pad ld-main">
              <div className="ld-top"><span className="ld-big">{pct}<small>%</small></span><p><b>of {abbr} done</b>{lead.lessonsCompleted} of {lead.lessonsTotal} lessons</p></div>
              <div className={batchAt === null ? '' : 'ld-pace'}>
                <div className="ld-bar" style={{ height: 10, borderRadius: 5 }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={batchAt === null ? 'Course progress' : `You have done ${lead.lessonsCompleted} lessons; ${d.released} are open to your batch`}><i style={{ width: `${pct}%` }} /></div>
                {batchAt !== null && <span className="mk" style={{ left: `${batchAt}%`, '--shift': batchAt > 85 ? '-100%' : batchAt < 15 ? '0%' : '-50%' } as CSSProperties} aria-hidden="true"><span>Batch: lesson {d.released}</span></span>}
              </div>
              {behind !== null && (
                <p className="ld-pacenote">{behind <= 2
                  ? <><b>You are on track with your batch.</b></>
                  : <><b>{behind} lessons behind the batch.</b>{resume ? ` Finish “${resume.title}” next to catch up.` : ''}</>}</p>
              )}
              <dl className="ld-stats" style={{ '--n': d.stats.length } as CSSProperties}>
                {d.stats.map((s) => <div key={s.label} className="flex flex-col-reverse justify-end"><dt>{s.label}</dt><dd>{s.value}</dd></div>)}
              </dl>
            </div>
            {d.week.items.length > 0 && (
              <div className="ld-card ld-pad">
                <div className="ld-wh"><div><h3 className="ld-h3">{d.week.title}</h3><span className="m">{d.week.range}</span></div>{doneInWeek > 0 && <span className="m">{doneInWeek} of {d.week.items.length} done</span>}</div>
                <ul className="ld-check">
                  {d.week.items.map((i) => (
                    <li key={i.key} className={i.state === 'done' ? 'dn' : undefined}>
                      <span className={`st${i.state === 'done' ? ' ok' : i.state === 'half' ? ' half' : ''}`}>{i.state === 'done' && <Icon name="check" className="h-3.5 w-3.5" />}<span className="sr-only">{i.state === 'done' ? 'Done' : i.state === 'half' ? 'Started' : 'To do'}</span></span>
                      <span><b>{i.title}</b><span className="d">{i.detail}</span></span>
                      {i.href ? <Link href={i.href} className="ld-link" aria-label={`${i.action}: ${i.title}`}>{i.action}</Link> : <span />}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="live-h" className="ld-s">
        <div className="ld-wrap">
          <div className="ld-head"><h2 id="live-h" className="ld-h2">Live classes</h2><More href={`${base}/live`}>Open live classes</More></div>
          <div className="grid gap-[clamp(36px,4vw,52px)]">
            <div>
              <div className="ld-sub"><div><h3>Scheduled classes</h3>{d.batch?.schedule && <p>{d.batch.schedule}{upcoming[0]?.teams ? ' on Microsoft Teams' : ''}</p>}</div></div>
              <ScheduledClasses sessions={upcoming} now={d.now} />
            </div>
            <div>
              <div className="ld-sub"><div><h3>Recorded classes</h3>{ready > 0 && <p>{ready} {ready === 1 ? 'recording' : 'recordings'}</p>}</div>{recordings.length > 3 && <More href={`${base}/live#recorded`}>See all recorded classes</More>}</div>
              {shown.length ? (
                <div className="ld-recs swipe">
                  {shown.map((r) => 'lesson' in r ? <RecordingCard key={r.lesson.id} slug={slug} lesson={r.lesson} at={r.at} /> : <PendingRecording key={r.id} session={r} />)}
                </div>
              ) : <p className="ld-empty">Recordings appear here after each class.</p>}
            </div>
          </div>
        </div>
      </section>

      {months.length > 0 && (
        <section aria-labelledby="over-h" className="ld-panel mist ld-s">
          <div className="ld-wrap">
            <div className="ld-head">
              <div><h2 id="over-h" className="ld-h2">Course overview</h2><p>You are in month {d.currentMonth + 1} of {months.length}.{nextLocked ? ` Month ${Number(nextLocked.number)} opens on ${nextLocked.opensOn}.` : ''}</p></div>
              {x.syllabusHref && <a href={x.syllabusHref} className="ld-link"><Icon name="down" className="h-4 w-4" />Download the syllabus</a>}
            </div>
            <Climb label="Months of the program" goal={x.goal} steps={months.map((mo) => ({
              key: mo.id, number: mo.number, title: mo.title, state: mo.state,
              detail: mo.state === 'locked' ? (mo.opensOn ? `Opens ${mo.opensOn}` : 'Locked') : mo.state === 'done' ? `Done · ${mo.total} of ${mo.total}` : `${mo.done} of ${mo.total} lessons`,
              href: `${base}/material`,
            }))} />
          </div>
        </section>
      )}

      <section aria-labelledby="mat-h" className="ld-s">
        <div className="ld-wrap">
          <div className="ld-head"><div><h2 id="mat-h" className="ld-h2">Study material</h2><p>Every video, recording, PDF and image, month by month.</p></div><More href={`${base}/material`}>Open course material</More></div>
          <div className={recent.length ? 'ld-2 top' : 'grid'}>
            <div className="ld-tiles">
              {material.map((t) => (
                <Link key={t.key} href={t.href} className="ld-tile"><span className="ti"><Icon name={t.icon} className="h-[22px] w-[22px]" /></span><b>{t.n}</b><span className="l">{t.label}</span>{t.fresh > 0 && <span className="nw">{t.fresh} new</span>}</Link>
              ))}
              {x.notes && <Link href="/learn/notes" className="ld-tile"><span className="ti"><Icon name="note" className="h-[22px] w-[22px]" /></span><b>{m.notes.length}</b><span className="l">My notes</span></Link>}
              {x.syllabusHref && <a href={x.syllabusHref} className="ld-tile"><span className="ti"><Icon name="down" className="h-[22px] w-[22px]" /></span><b>PDF</b><span className="l">Syllabus</span></a>}
            </div>
            {recent.length > 0 && (
              <div className="ld-rows">
                <h3 className="ld-h3 mb-1">Recently added</h3>
                {recent.map((l) => (
                  <Link key={l.id} href={`${base}/${l.id}`} className="ld-row">
                    <span className="ti"><Icon name={ICON[l.type] ?? 'doc'} className="h-5 w-5" /></span>
                    <span className="min-w-0"><b>{l.title}</b><span className="s">{[KIND[l.type] ?? 'Lesson', dateShort(l.publishedAt!)].join(' · ')}</span></span>
                    {l.isNew ? <span className="tag">New</span> : <span />}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Certificate and help" className="ld-panel ld-s">
        <div className="ld-wrap">
          <div className={x.certificates ? 'ld-2' : 'grid'}>
            {x.certificates && (
              <div className="ld-card ld-pad">
                <div className="ld-wh"><h2 className="ld-h3">Your certificate</h2><Link href="/certificates" className="ld-link">My certificates</Link></div>
                <ul className="ld-check">
                  {requirements.map((r) => (
                    <li key={r.label}><span className={`st${r.done ? ' ok' : ''}`}>{r.done && <Icon name="check" className="h-3.5 w-3.5" />}<span className="sr-only">{r.done ? 'Done' : 'To do'}</span></span><span><b>{r.label}</b></span><span className="d">{r.state}</span></li>
                  ))}
                </ul>
              </div>
            )}
            <div className="ld-card ld-pad ld-help">
              <div><h2 className="ld-h3">Stuck on something?</h2><p>Ask us. A real person answers.</p></div>
              {x.whatsapp
                ? <a href={x.whatsapp} target="_blank" rel="noopener noreferrer" className={buttonOutline}>Message us on WhatsApp</a>
                : <Link href="/account" className={buttonOutline}>Update my contact details</Link>}
            </div>
          </div>
          {x.others.length > 0 && (
            <div className="ld-rows mt-6">
              <h2 className="ld-h3 mb-1">Your other courses</h2>
              {x.others.map((e) => (
                <Link key={e.id} href={`/learn/${e.course.slug}/material`} className="ld-row"><span className="ti"><Icon name="book" className="h-5 w-5" /></span><span><b>{e.course.title}</b><span className="s">{e.status === 'completed' ? 'Completed' : `${e.lessonsCompleted} of ${e.lessonsTotal} lessons`}</span></span><span className="tag">Open</span></Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
