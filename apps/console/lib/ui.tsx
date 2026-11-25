import type { ReactNode } from 'react'

export const input =
  'w-full rounded-[var(--radius)] border border-border bg-bg px-3 py-2 text-base outline-none focus:border-primary'
export const button =
  'rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-60'

type Tone = 'ok' | 'warn' | 'bad' | 'quiet' | 'plain'
const TONES: Record<Tone, string> = {
  ok: 'bg-ok-bg text-ok-ink',
  warn: 'bg-tint-2 text-fg',
  bad: 'bg-danger-bg text-danger-ink',
  quiet: 'bg-muted text-grey',
  plain: 'bg-tint-1 text-fg',
}

/** A short status label. Colour never carries the meaning alone: the text always says it. */
export function Chip({ tone = 'plain', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-lg px-2.5 py-1 text-sm font-semibold ${TONES[tone]}`}>{children}</span>
}
