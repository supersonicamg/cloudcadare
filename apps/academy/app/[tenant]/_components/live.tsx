import Link from 'next/link'
import { dateShort, timeShort } from '@/lib/format'
import { calendarLink, dayNum, dayWord, isOpenNow, joinOpensAt, monthName, monthYear, weekday, weekdayLong, type ClassSession } from '@/lib/live'
import type { MaterialLesson } from '@/lib/material'
import { Ic } from './v11'
import './home-live.css'

// Live classes, as shown on Home and on the Live classes page: the next class, the list after it, and class recordings.

/** "8 pm to 10 pm" */
const range = (s: ClassSession) => `${timeShort(s.startsAt)} to ${timeShort(s.endsAt)}`

/** "1 h 52 min", "47 min". */
export function duration(seconds: number) {
  const m = Math.max(1, Math.round(seconds / 60))
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim() : `${m} min`
}

/** Later classes: weekday and date, title, time. `rows` draws the heavy top rule (a list on its own, not inside a card). */
export function ClassList({ sessions, rows = false }: { sessions: ClassSession[]; rows?: boolean }) {
  return (
    <ol className={`sched${rows ? ' rows flush' : ''}`}>
      {sessions.map((s) => (
        <li key={s.id}>
          <span className="dy">{weekday(s.startsAt)}<span>{dateShort(s.startsAt)}</span></span>
          <span><b className="t-card">{s.title}</b><br /><span className="t-label">{range(s)}</span></span>
          <span />
        </li>
      ))}
    </ol>
  )
}

/**
 * What to do about a class. While it is open the one filled button is "Join" (it goes through /api/live/[id]/join, which
 * opens the link only inside the class window and records attendance). Before that the only action is the calendar link,
 * with a line that says exactly when Join appears.
 */
export function ClassAction({ s, now, full = false }: { s: ClassSession; now: number; full?: boolean }) {
  const open = isOpenNow(s, now)
  const label = s.teams ? 'Join on Teams' : 'Join class'
  if (open) {
    return (
      <>
        <a href={`/api/live/${s.id}/join`} target="_blank" rel="noopener noreferrer" className={`btn${full ? ' btn-full' : ''}`}>{label}</a>
        <p className="t-label">{s.teams ? 'Opens Microsoft Teams in a new tab.' : 'Opens in a new tab.'} Your attendance is noted.</p>
      </>
    )
  }
  return (
    <>
      <a href={calendarLink(s)} target="_blank" rel="noopener noreferrer" className={`btn btn-line btn-sm${full ? ' btn-full' : ''}`}><Ic n="cal" />Add to calendar</a>
      <p className="t-label">The “{label}” button appears here at {joinOpensAt(s)}.</p>
    </>
  )
}

/** The next class on the Live classes page: the day as a numeral, then the title, then what to do. */
export function NextClassHero({ s, now }: { s: ClassSession; now: number }) {
  const open = isOpenNow(s, now)
  const word = dayWord(s.startsAt, now)
  return (
    <article className="nxt" aria-labelledby="nxt-h">
      <div className="cal">
        <span className="mo">{monthYear(s.startsAt)}</span>
        <span className="d">{dayNum(s.startsAt)}</span>
        <span className="t-label">{weekdayLong(s.startsAt)}</span>
      </div>
      <div className="mid">
        {open ? <p className="on-now"><i />On now</p> : <p className="t-label">Next class{word ? ` · ${word}` : ''}</p>}
        <h3 className="t-h3" id="nxt-h">{s.title}</h3>
        <p className="t-small">{range(s)}{s.teams ? ' · Microsoft Teams' : ''}</p>
      </div>
      <div className="act"><ClassAction s={s} now={now} /></div>
    </article>
  )
}

/** The next-class card on Home. */
export function NextClassCard({ s, now }: { s: ClassSession; now: number }) {
  const open = isOpenNow(s, now)
  const word = dayWord(s.startsAt, now)
  const day = word ? `${word[0]!.toUpperCase()}${word.slice(1)}` : `${weekday(s.startsAt)} ${dateShort(s.startsAt)}`
  return (
    <section className="card ncls" aria-labelledby="ncls-k">
      {open ? <p className="on-now" id="ncls-k"><i />Class on now</p> : <p className="t-label" id="ncls-k">Next live class</p>}
      <div className="ncls-row">
        <span className={`dblk${open ? ' on' : ''}`} aria-hidden="true"><b>{dayNum(s.startsAt)}</b><span>{weekday(s.startsAt)} · {monthName(s.startsAt)}</span></span>
        <div>
          <h2 className="t-card">{s.title}</h2>
          <p className="t-small">{day}, {range(s)}{s.teams ? ' · Microsoft Teams' : ''}</p>
        </div>
      </div>
      <div className="foot"><ClassAction s={s} now={now} full /></div>
    </section>
  )
}

/** One recording: the picture is the date (you remember a class by its day), the line is the learner's own state. */
export function RecordingCard({ slug, lesson: l, at }: { slug: string; lesson: MaterialLesson; at: string | null }) {
  const link = l.recording === 'link'
  const ready = l.recording !== 'none'
  const notes = l.noteCount ? ` · ${l.noteCount} ${l.noteCount === 1 ? 'note' : 'notes'}` : ''
  const when = at ? <span className="t-label">{weekdayLong(at)}</span> : null
  const state = !ready ? <span className="t-label">Recording on its way</span>
    : link ? <span className="t-label">Opens in Microsoft Teams</span>
    : l.done ? <span className="st"><Ic n="check" />Watched{notes}</span>
    : l.pct > 0 ? <span className="t-label"><b>{l.pct}% watched</b>{notes}</span>
    : l.isNew ? <span className="t-label"><b>New</b>{notes}</span>
    : <span className="t-label">Not watched yet{notes}</span>
  const body = (
    <>
      <span className={`rth${link || !ready ? ' soft' : ''}`}>
        {at && <span className="d"><b>{dayNum(at)}</b><span>{monthName(at)}</span></span>}
        {link && <span className="src"><Ic n="ext" s />Teams link</span>}
        {ready && !link && <span className="pl"><Ic n="play" /></span>}
        {ready && !link && l.durationSeconds ? <span className="du">{duration(l.durationSeconds)}</span> : null}
        {ready && !link && l.pct > 0 && !l.done && <span className="wp"><i style={{ width: `${l.pct}%` }} /></span>}
      </span>
      <span className="tx">{when}<b className="t-card">{l.title}</b>{state}</span>
    </>
  )
  if (!ready) return <div className="rec">{body}</div>
  return link
    ? <a className="rec" href={`/api/recording/${l.id}`} target="_blank" rel="noopener noreferrer">{body}</a>
    : <Link className="rec" href={`/learn/${slug}/${l.id}`}>{body}</Link>
}

/** A held class whose recording has no lesson yet. */
export function PendingRecording({ session }: { session: ClassSession }) {
  return (
    <div className="rec">
      <span className="rth soft"><span className="d"><b>{dayNum(session.startsAt)}</b><span>{monthName(session.startsAt)}</span></span></span>
      <span className="tx"><span className="t-label">{weekdayLong(session.startsAt)}</span><b className="t-card">{session.title}</b><span className="t-label">Recording on its way. It is usually up the same night.</span></span>
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
