'use client'

import { useActionState } from 'react'
import { button, input } from '@/lib/ui'
import { createKey, type CreateKeyState } from './actions'

export function CreateKeyForm({ plans }: { plans: { code: string; name: string }[] }) {
  const [state, action, pending] = useActionState<CreateKeyState, FormData>(createKey, {})
  return (
    <form action={action} className="max-w-md space-y-4">
      <div>
        <label htmlFor="plan" className="block text-sm font-medium">Plan</label>
        <select id="plan" name="plan" required className={input}>
          {plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="termDays" className="block text-sm font-medium">Term in days <span className="font-normal text-fg/60">(blank = open-ended trial)</span></label>
        <input id="termDays" name="termDays" inputMode="numeric" className={input} />
      </div>
      <div>
        <label htmlFor="restrictedEmail" className="block text-sm font-medium">Only this email may redeem <span className="font-normal text-fg/60">(optional)</span></label>
        <input id="restrictedEmail" name="restrictedEmail" type="email" className={input} />
      </div>
      <div>
        <label htmlFor="notes" className="block text-sm font-medium">Notes <span className="font-normal text-fg/60">(optional)</span></label>
        <input id="notes" name="notes" className={input} />
      </div>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button className={button} disabled={pending}>{pending ? 'Creating…' : 'Create key'}</button>
      {state.key && (
        <div className="rounded-[var(--radius)] border border-border bg-muted p-4">
          <p className="text-sm text-fg/70">Copy this now. It is shown once and cannot be recovered.</p>
          <p className="mt-2 select-all text-xl font-semibold tracking-wide">{state.key}</p>
        </div>
      )}
    </form>
  )
}
