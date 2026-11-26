'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Ic } from '../../_components/v11'
import { postProgress } from './use-progress'

export interface Neighbour { href: string; title: string }

/**
 * The one place a learner moves on from a lesson. The one filled button always goes forward:
 *   - "Mark complete and continue" when the lesson only counts once the learner says so;
 *   - "Next lesson: ..." otherwise (videos and recordings finish by themselves while they play);
 *   - "Back to my course" on the last lesson.
 * The way back (Previous) and what happens on its own sit on the left as plain words.
 */
export function LessonActions({ lessonId, rule, completed, tracked, autoOnOpen, plays, next, prev, backHref, quiet = false }: {
  lessonId: string; rule: string; completed: boolean; tracked: boolean
  /** Opening the lesson counts as finishing it (reading, files, images) unless its rule is "manual". */
  autoOnOpen: boolean
  /** A video or recording: it completes while it plays. */
  plays: boolean
  next: Neighbour | null; prev: Neighbour | null; backHref: string
  /** The forward button is an outline (a quiz that is not passed yet has its own filled button). */
  quiet?: boolean
}) {
  const router = useRouter()
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
  const cls = quiet ? 'btn btn-line' : 'btn'

  return (
    <div className="acts">
      <div className="lft">
        {prev && <Link href={prev.href} className="link link-s">Previous: {prev.title}</Link>}
        <span className="t-label" role="status">
          {done && !completed ? <span className="ok-line"><Ic n="check" s />Completed</span>
            : needsClick ? 'Press the button when you have finished this lesson.'
            : plays && tracked && !done ? 'This lesson is marked done by itself as you watch.'
            : null}
        </span>
      </div>
      {needsClick ? (
        <button type="button" disabled={pending} className={cls} onClick={() => start(async () => {
          const r = await postProgress({ lessonId, complete: true })
          if (r?.completed) { setDone(true); router.refresh(); router.push(target) }
        })}>
          {next ? 'Mark complete and continue' : 'Mark complete'}
        </button>
      ) : (
        <Link href={target} className={cls}>{next ? `Next lesson: ${next.title}` : 'Back to my course'}</Link>
      )}
    </div>
  )
}
