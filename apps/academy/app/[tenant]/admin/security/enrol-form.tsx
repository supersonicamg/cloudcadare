'use client'

import { useActionState, useState, useTransition } from 'react'
import { button, hint, input, label } from '@/lib/ui'
import { finishEnrol, startEnrol, type EnrolStart, type StepResult } from './actions'

export function EnrolForm({ next }: { next: string }) {
  const [setup, setSetup] = useState<Extract<EnrolStart, { factorId: string }> | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [starting, begin] = useTransition()

  if (!setup) {
    return (
      <div>
        <button className={button} disabled={starting} onClick={() => begin(async () => {
          const r = await startEnrol()
          if ('error' in r) setStartError(r.error); else setSetup(r)
        })}>{starting ? 'Starting…' : 'Set up authenticator app'}</button>
        {startError && <p role="alert" className="mt-3 text-sm text-danger">{startError}</p>}
      </div>
    )
  }
  return <Verify setup={setup} next={next} />
}

function Verify({ setup, next }: { setup: Extract<EnrolStart, { factorId: string }>; next: string }) {
  const [state, action, pending] = useActionState<StepResult, FormData>(finishEnrol.bind(null, setup.factorId, next), undefined)
  return (
    <div className="grid max-w-md gap-5">
      <ol className="list-decimal space-y-2 pl-5 text-[15px]">
        <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy).</li>
        <li>Scan this code, or type the key by hand.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URI from Supabase Auth */}
      <img src={setup.qr} alt="QR code for your authenticator app" width={192} height={192} className="rounded-[var(--radius)] border border-border bg-white p-2" />
      <p className="text-sm">Key: <code className="select-all break-all rounded bg-muted px-1.5 py-0.5" data-testid="totp-secret">{setup.secret}</code></p>
      <form action={action} className="grid gap-3">
        <div>
          <label htmlFor="code" className={label}>Code</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required className={input} />
          <p className={hint}>Keep the app: you will need it each time you sign in to change prices, payment settings or learners&rsquo; access.</p>
        </div>
        {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        <div><button className={button} disabled={pending}>{pending ? 'Checking…' : 'Turn on two-step check'}</button></div>
      </form>
    </div>
  )
}
