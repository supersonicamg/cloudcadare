import Link from 'next/link'
import { Icon } from '@educore/ui/marks'
import { dateShort, timeShort } from '@/lib/format'
import { calendarLink, dayOfMonth, isOpenNow, joinOpensAt, monthName, weekday, type ClassSession } from '@/lib/live'
import type { MaterialLesson } from '@/lib/material'
import { buttonLg, buttonOutline } from '@/lib/ui'

// Live classes, as shown on Home and on the Live classes page: the next class, the list after it, and class recordings.

const External = () => (
  <svg className="lx-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" /></svg>
)

export function DateBlock({ iso, soft = false }: { iso: string; soft?: boolean }) {
  return (
    <span className={`lx-date${soft ? ' soft' : ''}`}>
      <b>{dayOfMonth(iso)}</b>
      <span>{weekday(iso)} · {monthName(iso)}</span>
    </span>
  )
}

/** Later classes: weekday and date, title, time. */
export function ClassList({ sessions }: { sessions: ClassSession[] }) {
  return (
    <ol className="lx-sched">
      {sessions.map((s) => (
        <li key={s.id}>
          <span className="dy">{weekday(s.startsAt)}<span>{dateShort(s.startsAt)}</span></span>
          <span><b>{s.title}</b><span className="by">{timeShort(s.startsAt)} to {timeShort(s.endsAt)}</span></span>
        </li>
      ))}
    </ol>
  )
}

/** What to do about a class: join while it is open (the one filled button), otherwise add it to a calendar. */
function ClassAction({ s, now, filled }: { s: ClassSession; now: number; filled: boolean }) {
  const open = isOpenNow(s, now)
  const label = s.teams ? 'Join on Teams' : 'Join class'
  return (
    <>
      {open ? (
        <a href={`/api/live/${s.id}/join`} target="_blank" rel="noopener noreferrer" className={filled ? `${buttonLg} max-[720px]:w-full` : `${buttonOutline} max-[720px]:w-full`}>{label}<External /></a>
      ) : (
        <a href={calendarLink(s)} target="_blank" rel="noopener noreferrer" className={`${buttonOutline} max-[720px]:w-full`}><Icon name="calendar" className="lx-i" />Add to calendar</a>
      )}
      <span className="hint">{open ? (s.teams ? 'Opens Microsoft Teams in a new tab.' : 'Opens in a new tab.') : `The “${label}” button appears here at ${joinOpensAt(s)}.`}</span>
    </>
  )
}

/** The big card on the Live classes page: the next class and what to do about it. */
export function NextClassHero({ s, now }: { s: ClassSession; now: number }) {
  const open = isOpenNow(s, now)
  return (
    <article className={`lx-hero${open ? ' on' : ''}`} aria-label={open ? 'Class on now' : 'Next class'}>
      <DateBlock iso={s.startsAt} />
      <div className="min-w-0">
        <span className="lx-k">{open ? 'On now' : 'Next class'}</span>
        <h2>{s.title}</h2>
        <p className="when"><Icon name="clock" className="lx-i" />{weekday(s.startsAt)} {dateShort(s.startsAt)}, {timeShort(s.startsAt)} to {timeShort(s.endsAt)}</p>
      </div>
      <div className="act"><ClassAction s={s} now={now} filled /></div>
    </article>
  )
}

/** The small card on Home. */
export function NextClassCard({ s, now, filled }: { s: ClassSession; now: number; filled: boolean }) {
  const open = isOpenNow(s, now)
  return (
    <section className={`lx-card lx-class${open ? ' on' : ''}`} aria-label={open ? 'Class on now' : 'Next live class'}>
      <div>
        <p className="lx-k">{open ? 'Class on now' : 'Next live class'}</p>
        <div className="lx-class-body">
          <DateBlock iso={s.startsAt} />
          <div className="min-w-0">
            <h2>{s.title}</h2>
            <p className="when"><Icon name="clock" className="lx-i" />{timeShort(s.startsAt)} to {timeShort(s.endsAt)}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-2.5"><ClassAction s={s} now={now} filled={filled} /></div>
    </section>
  )
}

export function RecordingCard({ slug, lesson: l, at }: { slug: string; lesson: MaterialLesson; at: string | null }) {
  const link = l.recording === 'link'
  const ready = l.recording !== 'none'
  const minutes = l.durationSeconds ? Math.max(1, Math.round(l.durationSeconds / 60)) : null
  const notes = l.noteCount ? <span><Icon name="note" className="lx-i" />{l.noteCount} {l.noteCount === 1 ? 'note' : 'notes'}</span> : null
  const state = !ready ? <span>Recording on its way</span>
    : link ? <span><External />Opens in Microsoft Teams</span>
    : l.done ? <><span className="ok"><Icon name="check" className="lx-i" />Watched</span>{notes}</>
    : <><span>{l.pct > 0 ? `${l.pct}% watched` : l.isNew ? 'New' : 'Not watched yet'}</span>{notes}</>
  const body = (
    <>
      <span className={`lx-thumb${link || !ready ? ' soft' : ''}`}>
        {at && <span className="when" aria-hidden="true"><b>{dayOfMonth(at)}</b><span>{monthName(at)}</span></span>}
        {link && <span className="src"><External />Teams link</span>}
        {ready && !link && <span className="play"><Icon name="play" /></span>}
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
  if (!ready) return <div className="lx-rec">{body}</div>
  return link
    ? <a className="lx-rec" href={`/api/recording/${l.id}`} target="_blank" rel="noopener noreferrer">{body}</a>
    : <Link className="lx-rec" href={`/learn/${slug}/${l.id}`}>{body}</Link>
}

/** A held class whose recording has no lesson yet. */
export function PendingRecording({ session }: { session: ClassSession }) {
  return (
    <div className="lx-rec">
      <span className="lx-thumb soft"><span className="when" aria-hidden="true"><b>{dayOfMonth(session.startsAt)}</b><span>{monthName(session.startsAt)}</span></span></span>
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
