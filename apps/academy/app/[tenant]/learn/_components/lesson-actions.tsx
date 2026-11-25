'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon } from '@educore/ui/marks'
import { buttonLg, buttonLine } from '@/lib/ui'
import { useOptionalStage } from './stage'
import { postProgress } from './use-progress'

export interface Neighbour { href: string; title: string }

/**
 * The one place a learner moves on from a lesson. The big filled button always goes forward:
 *   - "Mark complete and continue" when the lesson only counts once the learner says so;
 *   - "Next lesson" otherwise (videos and recordings finish by themselves while they play);
 *   - "Back to my course" on the last lesson.
 * On a phone the bar sticks to the bottom of the screen with two small buttons beside it (Lessons, Notes) that open the
 * side panel as a sheet, so the three things a learner does while studying are always one thumb away.
 */
export function LessonActions({ lessonId, rule, completed, tracked, autoOnOpen, plays, next, prev, backHref, quiet = false, notes = false }: {
  lessonId: string; rule: string; completed: boolean; tracked: boolean
  /** Opening the lesson counts as finishing it (reading, files, images) unless its rule is "manual". */
  autoOnOpen: boolean
  /** A video or recording: it completes while it plays. */
  plays: boolean
  next: Neighbour | null; prev: Neighbour | null; backHref: string
  /** The next button is an outline (a quiz that is not passed yet has its own filled button). */
  quiet?: boolean
  /** The lesson has a notes tab. */
  notes?: boolean
}) {
  const router = useRouter()
  const stage = useOptionalStage()
  const [done, setDone] = useState(completed)
  const [pending, start] = useTransition()
  const sent = useRef(false)

  useEffect(() => {
    if (!tracked || done || !autoOnOpen || rule === 'manual' || sent.current) return
    sent.current = true
    void postProgress({ lessonId }).then((r) => { if (r?.completed) { setDone(true); router.refresh() } })
  }, [lessonId, rule, done, tracked, autoOnOpen, router])

  const needsClick = tracked && !done && rule === 'manual'
  const target = next?.href ?? backHref
  const cls = `${quiet ? buttonLine : buttonLg} max-sm:flex-1`

  return (
    <div className="lx-acts">
      <div className="lx-acts-main">
        {prev && <Link href={prev.href} className="lx-prev" aria-label={`Previous lesson: ${prev.title}`}><Icon name="back" /><span>Previous</span></Link>}
        {needsClick ? (
          <button type="button" disabled={pending} className={cls} onClick={() => start(async () => {
            const r = await postProgress({ lessonId, complete: true })
            if (r?.completed) { setDone(true); router.refresh(); router.push(target) }
          })}>
            {next ? 'Mark complete and continue' : 'Mark complete'}<Icon name="arrow" />
          </button>
        ) : (
          <Link href={target} className={cls}>{next ? 'Next lesson' : 'Back to my course'}<Icon name="arrow" /></Link>
        )}
      </div>
      <p className="lx-acts-hint" role="status">
        {done && !completed ? <><Icon name="check" className="lx-i" /><b>Completed.</b></>
          : needsClick ? 'Press the button when you have finished this lesson.'
          : plays && tracked ? 'This lesson is marked complete by itself as you watch.'
          : null}
        {next && <span className="up"> Up next: {next.title}</span>}
      </p>
      {stage && (
        <div className="lx-dock" aria-label="Lesson tools">
          <button type="button" className={buttonLine} onClick={() => stage.setSheet('list')}><Icon name="list" />Lessons</button>
          {notes && stage.enabled && <button type="button" className={buttonLine} onClick={() => stage.setSheet('notes')}><Icon name="note" />Notes{stage.notes.length > 0 && <em>{stage.notes.length}</em>}</button>}
        </div>
      )}
    </div>
  )
}
