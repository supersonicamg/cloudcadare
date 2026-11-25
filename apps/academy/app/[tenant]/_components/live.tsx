import Link from 'next/link'
import { Icon } from '@educore/ui/marks'
import { dateShort, timeShort } from '@/lib/format'
import { calendarLink, dayOfMonth, isOpenNow, joinOpensAt, monthName, weekday, type ClassSession } from '@/lib/live'
import type { MaterialLesson } from '@/lib/material'
import { buttonSm, buttonOutline } from '@/lib/ui'

// The two halves of "Live classes", used by the dashboard and the live classes page:
// ScheduledClasses (the next class as a card, the ones after it as a list) and RecordingCard.

const External = () => (
  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" /></svg>
)

export function DateBlock({ iso, soft = false }: { iso: string; soft?: boolean }) {
  return (
    <span className={`ld-date${soft ? ' soft' : ''}`}>
      <b>{dayOfMonth(iso)}</b>
      <span>{weekday(iso)} · {monthName(iso)}</span>
    </span>
  )
}

export function ClassList({ sessions }: { sessions: ClassSession[] }) {
  return (
    <ol className="ld-list">
      {sessions.map((s) => (
        <li key={s.id}>
          <span className="dy">{weekday(s.startsAt)}<span>{dateShort(s.startsAt)}</span></span>
          <span><b>{s.title}</b><span className="by">{timeShort(s.startsAt)} to {timeShort(s.endsAt)}</span></span>
        </li>
      ))}
    </ol>
  )
}

export function ScheduledClasses({ sessions, now, after = 3 }: { sessions: ClassSession[]; now: number; after?: number }) {
  const [next, ...rest] = sessions
  if (!next) return <p className="ld-empty">No class is scheduled right now. New classes appear here as soon as they are set up.</p>
  const open = isOpenNow(next, now)
  const later = rest.slice(0, after)
  return (
    <div className={later.length ? 'ld-sched' : 'ld-sched one'}>
      <article className={`ld-next${open ? ' open' : ''}`}>
        <DateBlock iso={next.startsAt} />
        <div className="min-w-0">
          <span className="k">{open ? 'On now' : 'Next class'}</span>
          <h4>{next.title}</h4>
          <p className="m"><Icon name="clock" className="h-4 w-4 text-primary" />{timeShort(next.startsAt)} to {timeShort(next.endsAt)}</p>
        </div>
        <div className="act">
          {open ? (
            <a href={`/api/live/${next.id}/join`} target="_blank" rel="noopener noreferrer" className={`${buttonSm} ld-wide`}>{next.teams ? 'Join on Teams' : 'Join class'}<External /></a>
          ) : (
            <a href={calendarLink(next)} target="_blank" rel="noopener noreferrer" className={`${buttonOutline} ld-wide`}><Icon name="calendar" className="h-4 w-4" />Add to calendar</a>
          )}
          <span className="hint">{open ? (next.teams ? 'Opens Microsoft Teams in a new tab' : 'Opens in a new tab') : `“${next.teams ? 'Join on Teams' : 'Join class'}” appears here at ${joinOpensAt(next)}`}</span>
        </div>
      </article>
      {later.length > 0 && <ClassList sessions={later} />}
    </div>
  )
}

export function RecordingCard({ slug, lesson: l, at }: { slug: string; lesson: MaterialLesson; at: string | null }) {
  const link = l.recording === 'link'
  const ready = l.recording !== 'none'
  const minutes = l.durationSeconds ? Math.max(1, Math.round(l.durationSeconds / 60)) : null
  const notes = l.noteCount ? <span><Icon name="note" className="h-4 w-4 text-primary" />{l.noteCount} {l.noteCount === 1 ? 'note' : 'notes'}</span> : null
  const state = !ready ? <span>Recording on its way</span>
    : link ? <span><External />{l.done ? 'Opened · opens in Teams' : 'Opens in Microsoft Teams'}</span>
    : l.done ? <><span className="ok"><Icon name="check" className="h-4 w-4" />Watched</span>{notes}</>
    : <><span>{l.pct > 0 ? `${l.pct}% watched` : l.isNew ? 'New' : 'Not started'}</span>{notes}</>
  const body = (
    <>
      <span className={`ld-thumb${link || !ready ? ' soft' : ''}`}>
        {at && <span className="when" aria-hidden="true"><b>{dayOfMonth(at)}</b><span>{monthName(at)}</span></span>}
        {link && <span className="src"><External />Teams link</span>}
        {ready && !link && <span className="play"><Icon name="play" className="h-4 w-4" /></span>}
        {minutes && <span className="dur">{minutes} min</span>}
        {!link && l.pct > 0 && !l.done && <span className="wp"><i style={{ width: `${l.pct}%` }} /></span>}
      </span>
      <span className="tx">
        {at && <span className="d">{weekday(at)} {dateShort(at)}</span>}
        <b>{l.title}</b>
        <span className="p">{state}</span>
      </span>
    </>
  )
  if (!ready) return <div className="ld-rec">{body}</div>
  return link
    ? <a className="ld-rec" href={`/api/recording/${l.id}`} target="_blank" rel="noopener noreferrer">{body}</a>
    : <Link className="ld-rec" href={`/learn/${slug}/${l.id}`}>{body}</Link>
}

/** A held class whose recording has no lesson yet. */
export function PendingRecording({ session }: { session: ClassSession }) {
  return (
    <div className="ld-rec">
      <span className="ld-thumb soft"><span className="when" aria-hidden="true"><b>{dayOfMonth(session.startsAt)}</b><span>{monthName(session.startsAt)}</span></span></span>
      <span className="tx"><span className="d">{weekday(session.startsAt)} {dateShort(session.startsAt)}</span><b>{session.title}</b><span className="p">Recording on its way. It is usually up the same night.</span></span>
    </div>
  )
}

/**
 * Recorded classes, newest first: the live lessons the learner may open, dated by their class. A lesson with nothing
 * attached appears ("on its way") only once its class has been held.
 */
export function recordingsOf(lessons: MaterialLesson[], sessions: ClassSession[], now: number) {
  const classOf = new Map(sessions.filter((s) => s.lessonId).map((s) => [s.lessonId!, s]))
  return lessons
    .filter((l) => l.type === 'live' && !l.lock && (l.recording !== 'none' || new Date(classOf.get(l.id)?.endsAt ?? Infinity).getTime() <= now))
    .map((l) => ({ lesson: l, at: classOf.get(l.id)?.startsAt ?? l.publishedAt }))
    .sort((x, y) => (y.at ?? '').localeCompare(x.at ?? ''))
}
