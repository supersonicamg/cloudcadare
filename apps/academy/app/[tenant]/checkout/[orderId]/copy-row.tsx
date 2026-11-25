'use client'

import { useState } from 'react'

/** A value the learner must type exactly (UPI ID, payment note): label first, value in ink, one tap to copy. */
export function CopyRow({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false)
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border bg-white py-1 pl-4 pr-1.5">
      <p className="t-label min-w-0 !text-mute">{label} <b className="ml-1.5 break-all font-bold tnum !text-fg">{value}</b></p>
      <button type="button" className="inline-flex min-h-11 shrink-0 items-center rounded-[10px] bg-muted px-4 t-label !text-fg hover:bg-border"
        onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1800) } catch { /* the value is on screen: the learner can select it */ } }}>
        {done ? 'Copied' : 'Copy'}<span className="sr-only"> {label}</span>
      </button>
    </div>
  )
}
