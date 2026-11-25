'use client'

import { useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { buttonOutline } from '@/lib/ui'

function Yes({ text }: { text: string }) {
  const { pending } = useFormStatus()
  return (
    <button disabled={pending} className="inline-flex h-11 items-center rounded-[10px] bg-danger-ink px-4 text-[15px] font-semibold text-white disabled:opacity-60">
      {pending ? 'Working…' : text}
    </button>
  )
}

/**
 * A destructive action in two steps: the first press only asks "are you sure?", in plain words, next to the button.
 * `children` are extra fields sent with it (such as a reason).
 */
export function ConfirmButton({ action, label, question, yes, children, name }: {
  action: (form: FormData) => void | Promise<void>; label: string; question: string; yes: string; children?: ReactNode
  /** Read out instead of the label, when several buttons on a page say the same thing. */
  name?: string
}) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <button type="button" aria-label={name} onClick={() => setAsking(true)} className="inline-flex min-h-11 items-center rounded-[10px] px-3 t-label !text-danger-ink hover:bg-danger-bg">
        {label}
      </button>
    )
  }
  return (
    <form action={action} className="grid w-full gap-3 rounded-2xl bg-danger-bg p-4 text-left">
      <p className="t-label !text-fg">{question}</p>
      {children}
      <div className="flex flex-wrap gap-3">
        <Yes text={yes} />
        <button type="button" autoFocus className={`${buttonOutline} bg-white`} onClick={() => setAsking(false)}>No, keep it</button>
      </div>
    </form>
  )
}
