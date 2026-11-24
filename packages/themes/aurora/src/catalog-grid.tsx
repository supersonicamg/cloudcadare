'use client'

import { useMemo, useState } from 'react'
import type { CourseCardDto } from '@educore/ui/theme'
import { Logo, platformFor } from '@educore/ui/marks'
import { A, Arrow } from './parts'

const GROUP: Record<string, string> = {
  aws: 'Amazon Web Services', azure: 'Azure', kubernetes: 'DevOps', docker: 'DevOps', terraform: 'DevOps', github: 'DevOps', finops: 'FinOps', python: 'Python',
}
const TINT: Record<string, 1 | 2 | 3 | 4> = { aws: 2, azure: 3, kubernetes: 4, docker: 4, terraform: 4, github: 4, finops: 1, python: 1 }
const PAGE = 24

function money(minor: number, currency: string) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100)
}
function length(c: CourseCardDto) {
  if (c.estimatedMinutes) {
    const h = Math.round(c.estimatedMinutes / 60)
    return h >= 1 ? `${h} h of content` : `${c.estimatedMinutes} min`
  }
  return c.lessonCount ? `${c.lessonCount} lesson${c.lessonCount === 1 ? '' : 's'}` : null
}

/** Filter chips, search and the card grid. Everything is in the page already, so filtering is instant. */
export function CatalogGrid({ courses, plural }: { courses: CourseCardDto[]; plural: string }) {
  const [group, setGroup] = useState('')
  const [q, setQ] = useState('')
  const [shown, setShown] = useState(PAGE)

  const rows = useMemo(() => courses.map((c) => {
    const logo = platformFor(c.title, c.tags)
    return { c, logo, group: logo ? (GROUP[logo] ?? '') : '' }
  }), [courses])
  const groups = useMemo(() => [...new Set(rows.map((r) => r.group).filter(Boolean))].sort(), [rows])
  const needle = q.trim().toLowerCase()
  const list = rows.filter((r) => (!group || r.group === group) && (!needle || `${r.c.title} ${r.c.subtitle ?? ''} ${r.c.summary ?? ''}`.toLowerCase().includes(needle)))
  const visible = list.slice(0, shown)

  return (
    <>
      {(groups.length > 1 || courses.length > 12) && (
        <div className="cat-tools">
          {groups.length > 1 && (
            <div className="cat-chips" role="group" aria-label="Filter by platform">
              {['', ...groups].map((g) => (
                <button key={g} type="button" className="cat-chip" aria-pressed={group === g} onClick={() => { setGroup(g); setShown(PAGE) }}>{g || `All ${plural.toLowerCase()}`}</button>
              ))}
            </div>
          )}
          {courses.length > 12 && (
            <div className="cat-search">
              <label htmlFor="cat-q" className="sr-only">Search {plural.toLowerCase()}</label>
              <input id="cat-q" type="search" value={q} placeholder={`Search ${plural.toLowerCase()}`} onChange={(e) => { setQ(e.target.value); setShown(PAGE) }} />
            </div>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="cat-none body">
          Nothing matches that. <button type="button" className="tlink" onClick={() => { setGroup(''); setQ('') }}>Clear the filter</button>
        </p>
      ) : (
        <ul className="cat-grid" aria-live="polite">
          {visible.map(({ c, logo }) => {
            const tint = (logo && TINT[logo]) || 1
            const len = length(c)
            const p = c.price
            return (
              <li key={c.id} className="cat-card">
                <A href={`/courses/${c.slug}`} className="cat-link">
                  <div className="cat-top" style={{ background: `var(--t${tint})` }}>
                    <span className="tile">{logo ? <Logo name={logo} /> : <span className="cat-mono" aria-hidden="true">{c.title.slice(0, 1)}</span>}</span>
                    {len && <span className="cat-badge">{len}</span>}
                  </div>
                  <div className="cat-body">
                    <h2 className="cat-title">{c.title}</h2>
                    {(c.subtitle || c.summary) && <p className="cat-text">{c.subtitle ?? c.summary}</p>}
                    <div className="cat-foot">
                      {p ? (
                        <span className="cat-price"><b>{money(p.amountMinor, p.currency)}</b>{p.compareAtMinor && p.compareAtMinor > p.amountMinor && <s>{money(p.compareAtMinor, p.currency)}</s>}</span>
                      ) : c.enrolmentOpen ? (
                        <span className="cat-price"><b>Free</b></span>
                      ) : (
                        <span className="cat-soon">Opens soon</span>
                      )}
                      <span className="cat-go">View course <Arrow /></span>
                    </div>
                  </div>
                </A>
              </li>
            )
          })}
        </ul>
      )}

      {list.length > shown && (
        <div className="cat-more">
          <p className="small">Showing {visible.length} of {list.length}</p>
          <button type="button" className="btn btn-line" onClick={() => setShown((n) => n + PAGE)}>Show more</button>
        </div>
      )}
    </>
  )
}
