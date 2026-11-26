'use client'

import { clock } from '@/lib/clock'
import { useStage } from './stage'

/**
 * A strip under the video with one saffron tick for every note and bookmark (guide §9: the player's one saffron element;
 * plan/16 §6.4). Ticks are buttons: pressing one jumps there. The video keeps its own controls.
 */
export function ScrubMarks({ fallbackSeconds }: { fallbackSeconds: number | null }) {
  const s = useStage()
  const total = s.duration || fallbackSeconds || 0
  const marks = s.notes.filter((n) => n.positionSeconds !== null && total > 0)
  if (!s.enabled || !marks.length) return null
  return (
    <div className="marks">
      <div className="marks-track" role="group" aria-label="Your notes on the timeline">
        <span className="line" aria-hidden="true" />
        {marks.map((n) => (
          <button key={n.id} type="button" onClick={() => s.jump(n)} title={`${n.kind === 'bookmark' ? 'Bookmark' : 'Note'} at ${clock(n.positionSeconds!)}`}
            aria-label={`${n.kind === 'bookmark' ? 'Bookmark' : 'Note'} at ${clock(n.positionSeconds!)}`}
            style={{ left: `${Math.min(99, ((n.positionSeconds ?? 0) / total) * 100)}%` }} />
        ))}
      </div>
      <p className="t-label">{marks.length} {marks.length === 1 ? 'mark' : 'marks'} of yours on the timeline. Press one to jump there.</p>
    </div>
  )
}
