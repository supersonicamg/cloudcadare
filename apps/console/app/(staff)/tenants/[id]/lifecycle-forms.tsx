'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { input } from '@/lib/ui'
import { republish, resume, suspend, type ActionState } from './actions'

const danger = 'rounded-[var(--radius)] bg-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60'
const quiet = 'rounded-[var(--radius)] px-4 py-2 text-sm font-semibold text-fg shadow-[inset_0_0_0_2px_var(--color-fg)] hover:bg-muted disabled:opacity-60'

/** Step 2 of suspending: says what learners will see, asks for a note, then acts. Cancel is a plain link. */
export function SuspendPanel({ tenantId, name, cancelHref }: { tenantId: string; name: string; cancelHref: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(suspend, {})
  return (
    <form action={action} className="mt-7 max-w-[620px] rounded-2xl bg-danger-bg p-6">
      <input type="hidden" name="tenantId" value={tenantId} />
      <h2 className="text-xl font-semibold tracking-tight text-danger-ink">Suspend {name}?</h2>
      <p className="mt-1.5 text-[15px] leading-relaxed text-fg/85">
        Learners and staff will see “This academy is temporarily unavailable” until you resume it. Their data and
        certificates stay safe, and certificate checks keep working.
      </p>
      <div className="mt-4">
        <label htmlFor="note" className="block text-[15px] font-semibold">Note for the team</label>
        <input id="note" name="note" required minLength={3} maxLength={300} placeholder="Why, for example: unpaid invoice 114" className={`${input} mt-2`} />
      </div>
      {state.error && <p role="alert" className="mt-3 text-sm font-medium text-danger-ink">{state.error}</p>}
      <div className="mt-4 flex items-center gap-5">
        <button className={danger} disabled={pending}>{pending ? 'Suspending…' : 'Suspend academy'}</button>
        <Link href={cancelHref} className="text-sm font-semibold underline underline-offset-2">Cancel</Link>
      </div>
    </form>
  )
}

export function ResumeButton({ tenantId }: { tenantId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(resume, {})
  return (
    <form action={action}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <button className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-60" disabled={pending}>
        {pending ? 'Resuming…' : 'Resume academy'}
      </button>
      {state.error && <p role="alert" className="mt-2 max-w-md text-sm text-danger-ink">{state.error}</p>}
    </form>
  )
}

export function RepublishButton({ tenantId }: { tenantId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(republish, {})
  return (
    <form action={action}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <button className={quiet} disabled={pending}>{pending ? 'Updating…' : 'Update address list'}</button>
      {state.ok && <p role="status" className="mt-2 text-sm text-ok-ink">{state.ok}</p>}
      {state.error && <p role="alert" className="mt-2 max-w-md text-sm text-danger-ink">{state.error}</p>}
    </form>
  )
}
