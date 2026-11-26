'use client'

import { useId, useState, type ReactNode } from 'react'

export interface Method {
  id: string
  title: string
  sub: string
  /** "Coming soon": shown, never selectable (aria-disabled, no handler). */
  soon?: boolean
  /** The tag on a `soon` method. Defaults to "Coming soon". */
  soonLabel?: string
  /** What opens when this method is chosen. Rendered by the server, so the QR needs no client code. */
  panel: ReactNode
}

/**
 * Payment methods as a radio group. A method that is not available yet is listed so the learner knows it is coming, but
 * it is dashed, has no radio dot and cannot be chosen. Only the chosen method's panel is shown. Returns a fragment and
 * the panel sits in a `display: contents` group, so the panel's blocks are direct children of the checkout column (the
 * "I have paid" bar sticks to the bottom of that column on phones).
 */
export function MethodPicker({ methods, initial }: { methods: Method[]; initial: string }) {
  const [chosen, setChosen] = useState(initial)
  const name = useId()
  const current = methods.find((m) => m.id === chosen)
  return (
    <>
      <fieldset className="methods">
        <legend className="t-card" style={{ marginBottom: 10 }}>How do you want to pay?</legend>
        {methods.map((m) => (
          <label key={m.id} className={`method ${m.soon ? 'off' : chosen === m.id ? 'on' : ''}`} aria-disabled={m.soon || undefined}>
            <input type="radio" name={name} value={m.id} checked={chosen === m.id} disabled={m.soon} onChange={() => setChosen(m.id)} className="sr" />
            <span className="rd" aria-hidden="true" />
            <span className="tx"><b className="t-card">{m.title}</b><span className="t-label">{m.sub}</span></span>
            {m.soon ? <span className="t-label"><b>{m.soonLabel ?? 'Coming soon'}</b></span> : <span />}
          </label>
        ))}
      </fieldset>
      <div role="group" aria-label={current?.title} style={{ display: 'contents' }}>{current?.panel}</div>
    </>
  )
}
