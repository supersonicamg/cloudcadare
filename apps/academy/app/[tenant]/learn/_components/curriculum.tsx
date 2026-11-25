import Link from 'next/link'
import { Icon, type IconName } from '@educore/ui/marks'
import type { LearnLesson, LearnSection } from '@/lib/learn'

const TYPE_ICON: Record<string, IconName> = {
  video: 'video', live: 'video', article: 'doc', pdf: 'doc', document: 'doc', download: 'down', external_link: 'link', quiz: 'quiz', test: 'quiz', assignment: 'doc', lab: 'lab',
}
const TYPE_LABEL: Record<string, string> = { article: 'min read', quiz: 'Quiz', test: 'Test' }

export const dripDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
export const minutes = (s: number | null) => (s ? `${Math.max(1, Math.round(s / 60))} min` : null)

const countLessons = (s: LearnSection): { done: number; total: number } =>
  s.children.reduce((n, c) => { const k = countLessons(c); return { done: n.done + k.done, total: n.total + k.total } },
    { done: s.lessons.filter((l) => l.done).length, total: s.lessons.length })

const hasLesson = (s: LearnSection, id?: string): boolean => Boolean(id) && (s.lessons.some((l) => l.id === id) || s.children.some((c) => hasLesson(c, id)))

function Row({ slug, l, current, upNext, compact }: { slug: string; l: LearnLesson; current: boolean; upNext: boolean; compact: boolean }) {
  const base = '-mx-2.5 grid items-center gap-3 rounded-xl px-2.5 py-3 text-base'
  const cols = compact ? 'grid-cols-[28px_22px_1fr]' : 'grid-cols-[28px_22px_1fr_auto] max-sm:grid-cols-[26px_1fr_auto]'
  const icon = TYPE_ICON[l.type] ?? 'doc'
  const meta = l.type === 'quiz' || l.type === 'test' ? TYPE_LABEL[l.type] : minutes(l.durationSeconds)
  if (l.lock) {
    return (
      <li data-locked className={`${base} ${cols} text-mute`}>
        <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-field"><Icon name="lock" className="h-3.5 w-3.5" /></span>
        <Icon name={icon} className="h-[22px] w-[22px] max-sm:hidden" />
        <span>{l.title}</span>
        {!compact && <span className="whitespace-nowrap text-sm">{l.lock.reason === 'drip' && l.lock.unlocksAt ? `Opens ${dripDate(l.lock.unlocksAt)}` : 'Locked'}</span>}
      </li>
    )
  }
  const state = l.done ? 'border-primary bg-primary text-primary-fg' : current || upNext ? 'border-fg bg-accent text-fg' : 'border-field'
  return (
    <li>
      <Link href={`/learn/${slug}/${l.id}`} aria-current={current ? 'page' : undefined}
        className={`${base} ${cols} hover:bg-tint-1/60 ${current || upNext ? 'bg-tint-2 font-semibold' : ''}`}>
        <span className={`grid h-6 w-6 place-items-center rounded-full border-2 ${state}`}>
          {l.done ? <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.8} /> : current || upNext ? <Icon name="play" className="h-3 w-3" fill="currentColor" strokeWidth={0} /> : null}
        </span>
        <Icon name={icon} className={`h-[22px] w-[22px] ${current || upNext ? 'text-fg' : 'text-mute'} max-sm:hidden`} />
        <span>{l.title}{l.done && <span className="sr-only"> Done</span>}</span>
        {!compact && (
          <span className={`whitespace-nowrap text-sm ${current || upNext ? 'font-semibold text-fg' : 'text-mute'}`}>
            {[meta, upNext && !l.done ? 'Up next' : null].filter(Boolean).join(' · ')}
          </span>
        )}
      </Link>
    </li>
  )
}

/**
 * Learner's curriculum with completion state, one section open at a time (the one holding the current or next
 * lesson). `compact` is the sidebar next to a lesson.
 */
export function Curriculum({ slug, sections, currentId, upNextId, compact = false, depth = 0 }: {
  slug: string; sections: LearnSection[]; currentId?: string; upNextId?: string; compact?: boolean; depth?: number
}) {
  const focus = currentId ?? upNextId
  const anyOpen = sections.some((s) => hasLesson(s, focus))
  return (
    <div className={depth ? 'ml-4 border-l border-border pl-4' : ''}>
      {sections.map((s, i) => {
        const { done, total } = countLessons(s)
        const open = anyOpen ? hasLesson(s, focus) : i === 0
        return (
          <details key={s.id} open={open} className={`group ${depth ? 'border-t border-border' : 'border-t-2 border-fg'} last:border-b last:border-b-border`}>
            <summary className="grid cursor-pointer list-none grid-cols-[40px_1fr_auto] items-center gap-x-4 gap-y-1 py-[18px] [&::-webkit-details-marker]:hidden max-sm:grid-cols-[30px_1fr]">
              <span className="font-heading text-xl font-extrabold text-primary">{s.label ?? String(i + 1).padStart(2, '0')}</span>
              <b className="text-[19px] font-semibold tracking-tight">{s.title}</b>
              <span className="text-sm text-mute max-sm:col-start-2">{total ? `${done} of ${total} done` : ''}</span>
            </summary>
            <ul className="pb-3">
              {s.lessons.map((l) => <Row key={l.id} slug={slug} l={l} current={l.id === currentId} upNext={l.id === upNextId} compact={compact} />)}
            </ul>
            {s.children.length > 0 && <div className="pb-3"><Curriculum slug={slug} sections={s.children} currentId={currentId} upNextId={upNextId} compact={compact} depth={depth + 1} /></div>}
          </details>
        )
      })}
    </div>
  )
}

export function ProgressBar({ pct, label, className = '' }: { pct: number; label: string; className?: string }) {
  return (
    <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}
      className={`h-2.5 w-full overflow-hidden rounded-full bg-[#E4E0D4] ${className}`}>
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}
