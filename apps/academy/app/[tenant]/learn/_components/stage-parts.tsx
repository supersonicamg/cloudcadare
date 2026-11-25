'use client'

import { clock } from '@/lib/clock'
import { useStage } from './stage'

/**
 * A strip under the video with one yellow tick for every note and bookmark (plan/16 §6.4; plan/15 §9: this is the
 * player's one yellow element). Ticks are buttons: pressing one jumps there. The native controls stay as they are.
 */
export function ScrubMarks({ fallbackSeconds }: { fallbackSeconds: number | null }) {
  const s = useStage()
  const total = s.duration || fallbackSeconds || 0
  const marks = s.notes.filter((n) => n.positionSeconds !== null && total > 0)
  if (!s.enabled || !marks.length) return null
  return (
    <div className="mt-3 grid gap-1.5">
      <div className="relative h-3" role="group" aria-label="Your notes on the timeline">
        <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border" aria-hidden="true" />
        {marks.map((n) => (
          <button key={n.id} type="button" onClick={() => s.jump(n)} title={`${n.kind === 'bookmark' ? 'Bookmark' : 'Note'} ${clock(n.positionSeconds!)}`}
            aria-label={`${n.kind === 'bookmark' ? 'Bookmark' : 'Note'} at ${clock(n.positionSeconds!)}`}
            className="absolute top-0 h-3 w-3 -translate-x-1/2 rounded-sm bg-accent ring-2 ring-white hover:scale-125 focus-visible:scale-125"
            style={{ left: `${Math.min(99, ((n.positionSeconds ?? 0) / total) * 100)}%` }} />
        ))}
      </div>
      <p className="t-small">{marks.length} {marks.length === 1 ? 'mark' : 'marks'} on this lesson. Press one to jump there.</p>
    </div>
  )
}

/**
 * The PDF in the browser's own viewer. A page cannot read which page the viewer is on, so the learner types the page
 * for a note (the panel does this); pressing a note jumps the frame to its page (`#page=N`).
 */
export function PdfFrame({ src, title }: { src: string; title: string }) {
  const s = useStage()
  return (
    <iframe key={`${s.page}-${s.jumpTick}`} src={`${src}#page=${s.page}`} title={title} className="h-[75vh] w-full rounded-2xl border border-border" />
  )
}

/** The picture, large, with a link to open it at full size. */
export function ImageFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl border border-border bg-muted" aria-label={`${alt} (opens full size)`}>
      {/* A lesson image behind a permission check and a short-lived link: the next/image optimiser cannot fetch it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="mx-auto max-h-[75vh] w-auto max-w-full object-contain" />
    </a>
  )
}
