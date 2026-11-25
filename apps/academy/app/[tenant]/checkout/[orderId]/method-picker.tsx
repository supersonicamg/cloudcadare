'use client'

import { useId, useState, type ReactNode } from 'react'

export interface Method {
  id: string
  title: string
  sub: string
  /** "Coming soon": shown, never selectable (aria-disabled, no handler). */
  soon?: boolean
  /** What opens when this method is chosen. Rendered by the server, so the QR needs no client code. */
  panel: ReactNode
}

/**
 * Payment methods as a radio group. A method that is not available yet is listed so the learner knows it is coming, but
 * it is greyed, has no radio and cannot be chosen. Only the chosen method's panel is shown.
 */
export function MethodPicker({ methods, initial }: { methods: Method[]; initial: string }) {
  const [chosen, setChosen] = useState(initial)
  const name = useId()
  const current = methods.find((m) => m.id === chosen)
  return (
    <div className="grid gap-5">
      <fieldset className="grid gap-3">
        <legend className="sr-only">How do you want to pay?</legend>
        {methods.map((m) => (
          <label key={m.id} aria-disabled={m.soon || undefined}
            className={`flex min-h-[72px] items-center gap-4 rounded-2xl border-2 px-5 py-3.5 ${m.soon ? 'border-border bg-muted/60 text-mute' : chosen === m.id ? 'cursor-pointer border-fg bg-white' : 'cursor-pointer border-border bg-white hover:border-field'}`}>
            <input type="radio" name={name} value={m.id} checked={chosen === m.id} disabled={m.soon} onChange={() => setChosen(m.id)} className="peer sr-only" />
            <span aria-hidden="true" className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${m.soon ? 'border-border' : chosen === m.id ? 'border-fg' : 'border-field'} peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-[3px] peer-focus-visible:outline-accent`}>
              {chosen === m.id && !m.soon && <span className="h-3 w-3 rounded-full bg-fg" />}
            </span>
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className={`t-card ${m.soon ? '!text-mute' : ''}`}>{m.title}</span>
              <span className="t-small">{m.sub}</span>
            </span>
            {m.soon && <span className="t-label shrink-0 rounded-full border border-border bg-white px-3 py-1 !text-mute">Coming soon</span>}
          </label>
        ))}
      </fieldset>
      <div role="group" aria-label={current?.title}>{current?.panel}</div>
    </div>
  )
}
