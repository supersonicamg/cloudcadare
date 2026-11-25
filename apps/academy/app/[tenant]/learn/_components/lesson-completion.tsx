'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { postProgress } from './use-progress'

/**
 * For lessons that are not a video: opening the lesson counts as viewing it. Lessons whose rule is "manual"
 * show a button instead. Free previews (not enrolled) are viewable but not tracked, and show nothing.
 */
export function LessonCompletion({ lessonId, rule, completed, tracked, next }: {
  lessonId: string; rule: string; completed: boolean; tracked: boolean; next: string | null
}) {
  const router = useRouter()
  const [done, setDone] = useState(completed)
  const [pending, start] = useTransition()
  const sent = useRef(false)

  useEffect(() => {
    if (!tracked || done || rule === 'manual' || sent.current) return
    sent.current = true
    void postProgress({ lessonId }).then((r) => { if (r?.completed) { setDone(true); router.refresh() } })
  }, [lessonId, rule, done, tracked, router])

  if (!tracked) return null
  if (done) return <p className="text-sm text-mute">Marked complete</p>
  if (rule !== 'manual') return null
  return (
    <button className="text-base font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-60" disabled={pending} onClick={() => start(async () => {
      const r = await postProgress({ lessonId, complete: true })
      if (r?.completed) { setDone(true); router.refresh(); if (next) router.push(next) }
    })}>
      Mark as complete
    </button>
  )
}
