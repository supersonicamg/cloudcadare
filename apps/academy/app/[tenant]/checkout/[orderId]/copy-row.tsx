'use client'

import { useState } from 'react'
import { Ic } from '../../_components/v11'

/** A value the learner must type exactly (UPI ID, payment note): label first, value in ink, one tap to copy. Goes inside a `<dl className="copies">`. */
export function CopyRow({ label, value, tnum }: { label: string; value: string; tnum?: boolean }) {
  const [done, setDone] = useState(false)
  return (
    <div className="copy">
      <dt>{label}</dt>
      <dd className={tnum ? 'tnum' : undefined}>{value}</dd>
      <button type="button" className="btn btn-line btn-sm"
        onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1800) } catch { /* the value is on screen: the learner can select it */ } }}>
        <Ic n="copy" />{done ? 'Copied' : 'Copy'}<span className="sr"> {label}</span>
      </button>
    </div>
  )
}
