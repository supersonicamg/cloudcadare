import Link from 'next/link'
import type { LearnLesson, LearnSection } from '@/lib/learn'
import { Ic } from '../../_components/v11'
import { KIND, lockText, minutes } from './curriculum'
import '../my-course.css'

const flatten = (s: LearnSection): LearnLesson[] => [...s.lessons, ...s.children.flatMap(flatten)]
export const sectionHas = (s: LearnSection, id: string) => flatten(s).some((l) => l.id === id)

/**
 * The lesson list beside a lesson: every month, the one you are in open. Same rows as My course:
 * a tick when done, a lock when closed, the lesson you are on marked with a bar and aria-current.
 */
export function LessonList({ slug, sections, currentId }: { slug: string; sections: LearnSection[]; currentId: string }) {
  const open = sections.findIndex((s) => sectionHas(s, currentId))
  return (
    <div className="llist">
      {sections.map((s, i) => {
        const all = flatten(s)
        const done = all.filter((l) => l.done).length
        return (
          <details key={s.id} open={i === (open >= 0 ? open : 0)}>
            <summary>
              <span className="tx">
                <span className="t-label"><b>{s.label ?? `Month ${i + 1}`}</b></span>
                <span className="t-small">{s.title}</span>
              </span>
              <span className="end"><span className="t-label">{done} of {all.length} done</span><Ic n="chev" s className="chv" /></span>
            </summary>
            <ol className="side-l">
              {all.map((l, j) => {
                const here = l.id === currentId
                const meta = l.lock ? lockText(l.lock) : [KIND[l.type] ?? l.type, l.type === 'quiz' ? null : minutes(l.durationSeconds)].filter(Boolean).join(' · ')
                const mark = l.lock ? <span className="n lock"><Ic n="lock" s /><span className="sr">Locked</span></span>
                  : l.done ? <span className="n done"><Ic n="check" s /><span className="sr">Done</span></span>
                  : <span className="n">{j + 1}</span>
                const body = <>{mark}<span className="tx"><b>{l.title}</b><span>{meta}{here ? ' · now' : ''}</span></span></>
                return l.lock
                  ? <li key={l.id}><div className="lrow locked">{body}</div></li>
                  : <li key={l.id}><Link href={`/learn/${slug}/${l.id}`} className={`lrow${here ? ' cur' : ''}`} aria-current={here ? 'page' : undefined}>{body}</Link></li>
              })}
            </ol>
          </details>
        )
      })}
    </div>
  )
}
