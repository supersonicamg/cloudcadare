import type { IconName } from '../../_components/v11'

export const dripDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
export const minutes = (s: number | null) => (s ? `${Math.max(1, Math.round(s / 60))} min` : null)

/** What a lesson is, in plain words, by lesson type. */
export const KIND: Record<string, string> = { video: 'Video', live: 'Class recording', pdf: 'PDF', document: 'Document', image: 'Picture', article: 'Reading', quiz: 'Quiz', test: 'Test', download: 'Download', external_link: 'Link', lab: 'Lab' }
/** The v11 icon of a lesson type. */
export const KIND_ICON: Record<string, IconName> = { video: 'video', live: 'live', pdf: 'doc', document: 'doc', image: 'image', article: 'read', quiz: 'quiz', test: 'quiz', download: 'down', external_link: 'ext', lab: 'lab' }
/** The one fact a locked lesson shows: the day it opens, or what to finish first. */
export const lockText = (lock: { reason: string; unlocksAt: string | null }) =>
  lock.reason === 'drip' && lock.unlocksAt ? `Opens ${dripDate(lock.unlocksAt)}` : 'Finish earlier lessons first'

export function ProgressBar({ pct, label, className = '' }: { pct: number; label: string; className?: string }) {
  return (
    <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}
      className={`h-2.5 w-full overflow-hidden rounded-full bg-border ${className}`}>
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}
