import type { ReactNode } from 'react'
import { Icon, type IconName } from '@educore/ui/marks'

/**
 * Status chip (plan/16 §2b: status is shape + word + position, never colour alone). Palette stays teal, yellow
 * highlight and ink on stone: there is no red. Every chip has a word; all but "quiet" carry a shape.
 *   ok      verified, active          mist + tick
 *   wait    waiting for someone       pale yellow + clock
 *   action  needs the reader to act   stone + ink bar on the left + info mark
 *   locked  not open yet              stone + padlock
 *   new     just added                teal outline + dot
 *   quiet   ended, cancelled          stone, word only
 */
export type StatusTone = 'ok' | 'wait' | 'action' | 'locked' | 'new' | 'quiet'

const TONE: Record<StatusTone, { cls: string; icon?: IconName }> = {
  ok: { cls: 'bg-[#E4EFEB] text-deep!', icon: 'check' },
  wait: { cls: 'bg-tint-2 text-fg!', icon: 'clock' },
  action: { cls: 'bg-muted text-fg! shadow-[inset_3px_0_0_var(--color-fg)] pl-3', icon: 'info' },
  locked: { cls: 'bg-muted text-grey!', icon: 'lock' },
  new: { cls: 'border-[1.5px] border-primary text-primary!' },
  quiet: { cls: 'bg-muted text-grey!' },
}

export function StatusChip({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  const t = TONE[tone]
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 t-label ${t.cls}`}>
      {t.icon && <Icon name={t.icon} className="h-4 w-4 shrink-0" />}
      {tone === 'new' && <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
      {children}
    </span>
  )
}

/** The one dominant region of a screen: an inset stone panel (plan/15 §3). Fields and cards inside it are white. */
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[clamp(22px,2.6vw,32px)] bg-muted p-5 sm:p-8 ${className}`}>{children}</div>
}

/** Facts as a ruled list (a 2px ink rule on top, hairlines between), instead of a grid of boxes. */
export function Facts({ children }: { children: ReactNode }) {
  return <dl className="border-t-2 border-fg">{children}</dl>
}
export function Fact({ label, children, aside }: { label: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 border-b border-border py-3.5 sm:grid-cols-[168px_minmax(0,1fr)_auto]">
      <dt className="t-label col-span-2 sm:col-span-1">{label}</dt>
      <dd className="t-body col-span-2 !font-semibold !text-fg tnum sm:col-span-1">{children}</dd>
      {aside ? <span className="col-span-2 sm:col-span-1">{aside}</span> : <span className="hidden sm:block" />}
    </div>
  )
}

/** Quiet note with an icon: for "how you got access" and empty states. Ink on stone, never a warning colour. */
export function Note({ icon = 'info', children }: { icon?: IconName; children: ReactNode }) {
  return (
    <p className="t-body flex items-start gap-3 rounded-2xl bg-muted p-4 !text-fg">
      <Icon name={icon} className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <span>{children}</span>
    </p>
  )
}
