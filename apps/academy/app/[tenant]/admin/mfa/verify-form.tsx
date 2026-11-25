'use client'

import { useActionState } from 'react'
import { verifyStep, type StepResult } from '../security/actions'
import { button, input, label } from '@/lib/ui'

export function VerifyForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<StepResult, FormData>(verifyStep.bind(null, next), undefined)
  return (
    <form action={action} className="grid max-w-sm gap-4">
      <div>
        <label htmlFor="code" className={label}>Code from your authenticator app</label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required autoFocus className={input} />
      </div>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <div><button className={button} disabled={pending}>{pending ? 'Checking…' : 'Verify'}</button></div>
    </form>
  )
}
