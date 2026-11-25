import Link from 'next/link'
import { Icon } from '@educore/ui/marks'
import type { LearnLesson, LearnSection } from '@/lib/learn'
import { dripDate, minutes } from './curriculum'

const KIND: Record<string, string> = { video: 'Video', live: 'Class recording', pdf: 'PDF', document: 'Document', image: 'Image', article: 'Reading', quiz: 'Quiz', test: 'Test', download: 'Download', external_link: 'Link', lab: 'Lab' }

const flatten = (s: LearnSection): LearnLesson[] => [...s.lessons, ...s.children.flatMap(flatten)]
export const sectionHas = (s: LearnSection, id: string) => flatten(s).some((l) => l.id === id)

/**
 * The lesson list beside a lesson: every month, with the one you are in open. Same rows as the Lessons page:
 * a tick when done, a lock when closed, a yellow dot on the lesson you are on.
 */
export function LessonList({ slug, sections, currentId }: { slug: string; sections: LearnSection[]; currentId: string }) {
  const open = sections.findIndex((s) => sectionHas(s, currentId))
  return (
    <div className="lx-llist">
      {sections.map((s, i) => {
        const all = flatten(s)
        const done = all.filter((l) => l.done).length
        return (
          <details key={s.id} open={i === (open >= 0 ? open : 0)}>
            <summary>
              <span className="n">{s.label ?? String(i + 1).padStart(2, '0')}</span>
              <span className="t">{s.title}</span>
              <span className="c">{done} of {all.length}</span>
            </summary>
            <ul>
              {all.map((l) => {
                const here = l.id === currentId
                const meta = [KIND[l.type] ?? l.type, l.type === 'quiz' ? null : minutes(l.durationSeconds)].filter(Boolean).join(' · ')
                const mark = l.lock ? <span className="lx-st lock"><Icon name="lock" /><span className="sr-only">Locked</span></span>
                  : l.done ? <span className="lx-st ok"><Icon name="check" /><span className="sr-only">Done</span></span>
                  : here ? <span className="lx-st now"><span className="sr-only">Now playing</span></span>
                  : <span className="lx-st"><span className="sr-only">Not done</span></span>
                const body = (
                  <>
                    {mark}
                    <span className="min-w-0"><b>{l.title}</b><span className="m">{l.lock ? (l.lock.reason === 'drip' && l.lock.unlocksAt ? `Opens ${dripDate(l.lock.unlocksAt)}` : 'Finish earlier lessons first') : meta}</span></span>
                  </>
                )
                return l.lock
                  ? <li key={l.id} data-locked>{body}</li>
                  : <li key={l.id}><Link href={`/learn/${slug}/${l.id}`} aria-current={here ? 'page' : undefined}>{body}</Link></li>
              })}
            </ul>
          </details>
        )
      })}
    </div>
  )
}
