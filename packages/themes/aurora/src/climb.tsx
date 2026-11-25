'use client'

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Icon, Logo, LOGO_NAMES } from '@educore/ui/marks'
import type { NavItem, ProgramMonth } from '@educore/ui/theme'
import { A, Arrow } from './parts'
import { Diagram } from './diagrams'

const two = (n: number) => String(n).padStart(2, '0')

/**
 * The program as a climb (plan/15 §7.8): steps rising onto one baseline, and a panel for the month that is open.
 * One month's detail at a time, never auto-advancing. It is an ARIA tablist: arrow keys, Home and End move between
 * steps. The last month ends with the page's one filled button.
 */
export function Climb({ months, goal, join }: { months: ProgramMonth[]; goal: string; join: NavItem }) {
  const [i, setI] = useState(0)
  const id = useId()
  const steps = useRef<Array<HTMLButtonElement | null>>([])
  const moveFocus = useRef(false)

  // After a keyboard or Previous/Next move, focus follows the selected step.
  useEffect(() => {
    if (moveFocus.current) { steps.current[i]?.focus(); moveFocus.current = false }
  }, [i])

  const go = (n: number, focus = false) => { moveFocus.current = focus; setI(n) }
  const onKey = (e: KeyboardEvent) => {
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: months.length - 1 }[e.key]
    if (next === undefined) return
    e.preventDefault()
    go((next + months.length) % months.length, true)
  }

  const m = months[i]!
  const last = i === months.length - 1
  return (
    <>
      <div className="climb" role="tablist" aria-label="Program months" style={{ '--n': months.length } as CSSProperties} onKeyDown={onKey}>
        {months.map((s, j) => (
          <button
            key={s.title} ref={(el) => { steps.current[j] = el }} type="button" role="tab"
            id={`${id}-step-${j}`} aria-controls={`${id}-panel`} aria-selected={i === j} tabIndex={i === j ? 0 : -1}
            aria-label={`Month ${j + 1}: ${s.title}`}
            className={`step${j < i ? ' done' : ''}`} style={{ '--i': j } as CSSProperties} onClick={() => go(j)}
          >
            {j === months.length - 1 && <span className="goal"><Icon name="flag" className="ic" />{goal}</span>}
            <span className="top">
              <span className="mn">{two(j + 1)}</span>
              <span className="st-ok" aria-hidden="true"><Icon name="check" className="ic" /></span>
              <span className="wks">Weeks {s.weeks[0]}–{s.weeks[1]}</span>
            </span>
            <span className="h3">{s.title}</span>
            <span className="lgs">
              {s.logos?.map((k) => <span key={k}><Logo name={k} /></span>)}
              {s.icons?.map((k) => <span key={k}><Icon name={k} className="ic" /></span>)}
            </span>
          </button>
        ))}
      </div>

      {/* key: the panel remounts on every change, which replays its short fade-and-rise */}
      <div key={i} className="mdetail" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-step-${i}`}>
        <div className="md-copy">
          <div className="md-top">
            <span className="prog" aria-hidden="true">{months.map((_, j) => <i key={j} className={j <= i ? 'on' : undefined} />)}</span>
            <span className="wk">Month {i + 1} of {months.length} · Weeks {m.weeks[0]}–{m.weeks[1]}</span>
          </div>
          <h3 className="h3">{m.title}</h3>
          <p className="out"><Icon name="flag" className="ic" /><span><b>By week {m.weeks[1]}</b> you can {m.outcome}</span></p>
          <ul className="checks2">
            {m.topics.map((t) => (
              <li key={t.label}>
                <span className="lgw">{t.logo ? <Logo name={t.logo} label={LOGO_NAMES[t.logo]} /> : <Icon name="check" className="ic" />}</span>
                {t.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="build">
          <div><b>You build</b><p>{m.build}</p></div>
          <Diagram k={m.diagram} />
        </div>
        <div className="md-foot">
          <span className="meta"><Icon name="lab" className="ic" />{m.meta}</span>
          <span className="md-nav">
            {i > 0 && <button type="button" className="btn btn-sm btn-line" onClick={() => go(i - 1, true)}><span className="ar" aria-hidden="true">←</span> Month {i}</button>}
            {last
              ? <A className="btn btn-sm btn-brand" href={join.href}>{join.label}<Arrow /></A>
              : <button type="button" className="btn btn-sm btn-line" onClick={() => go(i + 1, true)}>Next: {months[i + 1]!.title} <span className="ar" aria-hidden="true">→</span></button>}
          </span>
        </div>
      </div>
    </>
  )
}
