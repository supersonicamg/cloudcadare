'use client'

import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { Icon } from '@educore/ui/marks'

export interface ClimbMonth {
  title: string
  number: string
  done: number
  total: number
  notes: number
  /** "7 Dec" when every lesson of the month is still locked. */
  opensOn: string | null
  next: Array<{ id: string; title: string; kind: string; isNew: boolean }>
}

/**
 * The learner's own climb (plan/15 §7.8): the program's months as steps, the current one open. An ARIA tablist: arrow keys,
 * Home and End move between months. Earlier months are ticked, later ones that are not open yet say when they open.
 * One month's detail at a time; nothing moves by itself.
 */
export function LearnerClimb({ months, current, slug, goal }: { months: ClimbMonth[]; current: number; slug: string; goal: string }) {
  const [i, setI] = useState(current)
  const id = useId()
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const go = (n: number, focus = false) => { setI(n); if (focus) setTimeout(() => refs.current[n]?.focus(), 0) }
  const onKey = (e: KeyboardEvent) => {
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: months.length - 1 }[e.key]
    if (next === undefined) return
    e.preventDefault()
    go((next + months.length) % months.length, true)
  }
  const m = months[i]!
  return (
    <>
      <div role="tablist" aria-label="Your months" onKeyDown={onKey} className="grid items-end gap-2.5" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
        {months.map((s, j) => {
          const done = s.total > 0 && s.done === s.total
          const on = i === j
          return (
            <button key={s.number + s.title} ref={(el) => { refs.current[j] = el }} type="button" role="tab" id={`${id}-t${j}`} aria-controls={`${id}-p`}
              aria-selected={on} tabIndex={on ? 0 : -1} onClick={() => go(j)} aria-label={`Month ${j + 1}: ${s.title}`}
              style={{ '--lift': `${j * 10}px` } as CSSProperties}
              className={`relative grid content-between gap-2 rounded-t-2xl border-b-2 border-fg p-3 text-left sm:p-4 sm:[min-height:calc(110px+var(--lift))] max-sm:min-h-24 ${on ? 'bg-deep text-white' : done ? 'bg-[#F2F7F5]' : 'bg-white'}`}>
              {j === months.length - 1 && <span className="absolute -top-3 right-3 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 t-small !font-bold !text-fg"><Icon name="flag" className="h-3.5 w-3.5" />{goal}</span>}
              <span className="flex items-center justify-between gap-2">
                <span className={`t-num !text-[26px] ${on ? '!text-accent' : done ? '!text-mute' : '!text-primary'}`}>{s.number}</span>
                {done && !on && <Icon name="check" className="h-5 w-5 text-primary" />}
              </span>
              <span className="grid gap-0.5">
                <b className={`text-[15px] font-bold leading-tight max-sm:hidden ${on ? 'text-white' : 'text-fg'}`}>{s.title}</b>
                <span className={`t-small tnum ${on ? '!text-white/85' : ''}`}>{s.opensOn ? `Opens ${s.opensOn}` : done ? `Done · ${s.total}` : `${s.done} of ${s.total}`}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div role="tabpanel" id={`${id}-p`} aria-labelledby={`${id}-t${i}`} className="mt-0 grid gap-6 rounded-b-[20px] rounded-t-none bg-white p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <p className="t-label !text-primary">Month {i + 1} of {months.length}</p>
          <h3 className="t-section">{m.title}</h3>
          <dl className="grid grid-cols-3 border-y-2 border-fg">
            {[[`${m.done}/${m.total}`, 'Lessons done'], [String(Math.max(0, m.total - m.done)), 'Left'], [String(m.notes), 'Notes taken']].map(([v, l]) => (
              <div key={l} className="grid gap-0.5 py-3 pr-3"><dd className="t-num !text-[30px]">{v}</dd><dt className="t-small">{l}</dt></div>
            ))}
          </dl>
        </div>
        <div className="grid content-start gap-2.5">
          <b className="t-label !text-primary">{m.opensOn ? `Opens ${m.opensOn}` : m.next.length ? `Up next in month ${i + 1}` : 'Everything in this month is done'}</b>
          {m.next.map((l) => (
            <Link key={l.id} href={`/learn/${slug}/${l.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3.5 py-3 hover:bg-[#E9E9E4]">
              <span className="grid min-w-0"><b className="truncate font-bold text-fg">{l.title}</b><span className="t-small">{l.kind}</span></span>
              {l.isNew && <span className="rounded-lg border-[1.5px] border-primary px-2 py-0.5 t-label !text-primary">New</span>}
            </Link>
          ))}
          <Link href={`/learn/${slug}/material`} className="t-label mt-1 font-semibold !text-primary underline-offset-4 hover:underline">Open course material <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </>
  )
}
