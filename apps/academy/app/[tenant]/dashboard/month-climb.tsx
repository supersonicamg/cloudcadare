'use client'

import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { Icon, type IconName } from '@educore/ui/marks'

export interface ClimbLesson { id: string; title: string; icon: IconName; kind: string; fact: string; state: 'done' | 'half' | 'todo' | 'locked' }
export interface ClimbMonth {
  id: string; number: string; title: string; done: number; total: number
  state: 'done' | 'now' | 'open' | 'locked'
  opensOn: string | null
  /** The lessons to show in the panel: what is next first. */
  next: ClimbLesson[]
  more: number
}

/**
 * The learner's own progress as the climb from plan/15 §7.8: the program's months as rising steps, the finished ones ticked,
 * the one they are in dark. Pressing a step shows that month underneath: what is next in it, and a way into all of it.
 * It is a real tab list: arrow keys, Home and End move between months.
 */
export function MonthClimb({ months, slug, goal, label }: { months: ClimbMonth[]; slug: string; goal?: string; label: string }) {
  const now = Math.max(0, months.findIndex((m) => m.state === 'now'))
  const [at, setAt] = useState(now)
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const cur = months[at]!
  const pct = cur.total ? (cur.done / cur.total) * 100 : 0

  const key = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const go = e.key === 'ArrowRight' ? (i + 1) % months.length : e.key === 'ArrowLeft' ? (i - 1 + months.length) % months.length : e.key === 'Home' ? 0 : e.key === 'End' ? months.length - 1 : null
    if (go === null) return
    e.preventDefault()
    setAt(go)
    tabs.current[go]?.focus()
  }

  return (
    <div className="lx-climb" style={{ '--n': months.length } as CSSProperties}>
      <div role="tablist" aria-label={label} className="lx-climb-steps">
        {months.map((m, i) => (
          <button key={m.id} ref={(el) => { tabs.current[i] = el }} type="button" role="tab" id={`month-tab-${i}`} aria-selected={at === i} aria-controls="month-panel" tabIndex={at === i ? 0 : -1}
            className={`step ${m.state}${at === i ? ' sel' : ''}`} style={{ '--i': i } as CSSProperties} onClick={() => setAt(i)} onKeyDown={(e) => key(e, i)}>
            {goal && i === months.length - 1 && <span className="goal"><Icon name="flag" />{goal}</span>}
            <span className="top">
              <span className="num">{m.number}</span>
              {m.state === 'done' ? <Icon name="check" className="mk" /> : m.state === 'locked' ? <Icon name="lock" className="mk" /> : null}
            </span>
            <span className="ttl">{m.title}</span>
            <span className="fact">{m.state === 'locked' ? (m.opensOn ? `Opens ${m.opensOn}` : 'Not open yet') : `${m.done} of ${m.total} done`}</span>
            <span className="bar" aria-hidden="true"><i style={{ width: `${m.total ? (m.done / m.total) * 100 : 0}%` }} /></span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id="month-panel" aria-labelledby={`month-tab-${at}`} className="lx-climb-panel" key={cur.id}>
        <div className="head">
          <div>
            <p className="lx-k">Month {at + 1} of {months.length}{cur.state === 'now' ? ' · you are here' : cur.state === 'done' ? ' · finished' : ''}</p>
            <h3>{cur.title}</h3>
          </div>
          {cur.state !== 'locked' && (
            <p className="sum"><b>{cur.done}</b> of {cur.total} lessons done
              <span className="lx-bar thin" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`Month ${at + 1} progress`}><i style={{ width: `${pct}%` }} /></span>
            </p>
          )}
        </div>

        {cur.state === 'locked' ? (
          <p className="lx-climb-lock"><Icon name="lock" />{cur.opensOn ? `This month opens on ${cur.opensOn}.` : 'This month is not open yet.'} The months before it stay open.</p>
        ) : cur.next.length === 0 ? (
          <p className="lx-climb-lock"><Icon name="check" />Every lesson in this month is done.</p>
        ) : (
          <>
            <p className="lx-climb-h">{cur.done > 0 || cur.state === 'now' ? 'Next in this month' : 'In this month'}</p>
            <ul className="lx-climb-list">
              {cur.next.map((l) => (
                <li key={l.id}>
                  <Link href={`/learn/${slug}/${l.id}`}>
                    <span className="ic"><Icon name={l.icon} /></span>
                    <span className="tx"><b>{l.title}</b><span>{l.kind}</span></span>
                    <span className={`fc${l.state === 'half' ? ' on' : ''}`}>{l.fact}</span>
                    <Icon name="chev" className="go" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {cur.state !== 'locked' && (
          <Link href={`/learn/${slug}/material?month=${cur.id}`} className="lx-link">
            {cur.more > 0 ? `See all ${cur.total} lessons in this month` : 'Open this month'}<Icon name="chev" />
          </Link>
        )}
      </div>
    </div>
  )
}
