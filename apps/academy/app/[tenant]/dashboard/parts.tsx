import Link from 'next/link'
import type { ReactNode } from 'react'
import type { BatchInfo } from '@/lib/dashboard'
import { dayNum, monthYear } from '@/lib/live'
import { Dg, diagramOfMonth, type IconName } from '../_components/v11'
import '../_components/home-live.css'

/** The v11 icon for a lesson type. */
export const LESSON_ICON: Record<string, IconName> = { video: 'video', live: 'video', pdf: 'doc', document: 'doc', image: 'image', article: 'read', quiz: 'quiz', test: 'quiz', download: 'down', external_link: 'ext', lab: 'lab', assignment: 'doc' }

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** The batch's week: the days classes run on, each with the time they start. Nothing when the batch does not say. */
export function Week({ batch, teams }: { batch: BatchInfo; teams?: boolean }) {
  if (!batch.days.length) return null
  return (
    <div>
      <p className="t-label"><b>Your week</b></p>
      <ul className="week" aria-label="Weekly schedule">
        {WEEK.map((d) => batch.days.includes(d)
          ? <li key={d} className="on"><span className="dn">{d}</span><span className="cell">{batch.at ?? 'Class'}</span></li>
          : <li key={d}><span className="dn">{d}</span><span className="cell" aria-label="free">–</span></li>)}
      </ul>
      <p className="legend"><span><i className="k-ink" />Live class{teams ? ' on Teams' : ''}</span></p>
    </div>
  )
}

/** The ticket's calendar: the start day as a huge numeral. Without a date it says so instead of guessing. */
export function Cal({ start, foot }: { start: Date | null; foot?: ReactNode }) {
  return start ? (
    <div className="cal">
      <span className="mo">{monthYear(start)}</span>
      <span className="d">{dayNum(start)}</span>
      {foot && <span className="t-label">{foot}</span>}
    </div>
  ) : (
    <div className="cal">
      <span className="mo">Next batch</span>
      <span className="t-card">Dates coming soon</span>
    </div>
  )
}

export interface MonthCardData {
  id: string
  title: string
  /** After "Month N": "finished", "you are here", "opens 4 Dec". */
  note?: string
  /** Where the card goes. Without one it is a plain, unclickable card. */
  href?: string
  state: 'done' | 'now' | 'open' | 'locked'
  /** Progress bar, 0 to 100. Left out when there is no progress to show (before the batch starts, or on the sales page). */
  pct?: number
  line: string
}

/** The program's months, each as the picture of the month, a label, a title and the learner's own progress. */
export function MonthCards({ months }: { months: MonthCardData[] }) {
  return (
    <ol className="mcards">
      {months.map((m, i) => {
        const body = (
          <>
            <Dg id={diagramOfMonth(i + 1)} />
            <div className="mc-b">
              <p className="t-label"><b>Month {i + 1}</b>{m.note ? ` · ${m.note}` : ''}</p>
              <h3 className="t-card">{m.title}</h3>
              {m.pct !== undefined && <span className="bar" aria-hidden="true"><i style={{ width: `${m.pct}%` }} /></span>}
              <p className="t-label ln">{m.line}</p>
            </div>
          </>
        )
        return (
          <li key={m.id}>
            {m.href && m.state !== 'locked'
              ? <Link className={`mcard${m.state === 'now' ? ' now' : ''}`} href={m.href} aria-current={m.state === 'now' ? 'step' : undefined}>{body}</Link>
              : <div className={`mcard${m.state === 'locked' ? ' locked' : ''}`}>{body}</div>}
          </li>
        )
      })}
    </ol>
  )
}
