'use client'

import { startTransition, useActionState, useEffect, useState, type FormEvent } from 'react'
import { Icon } from '@educore/ui/marks'
import { buttonLg } from '@/lib/ui'
import { resendCode, verifyCode, type ConfirmState } from './actions'

/**
 * One input, not six boxes: it takes a pasted code, the phone's one-time-code suggestion and screen readers all at
 * once. The digits are large, tabular and spaced so they are easy to check against the email.
 */
export function ConfirmForm({ next }: { next: string }) {
  const [state, verify, verifying] = useActionState<ConfirmState, FormData>(verifyCode, {})
  const [again, resend, resending] = useActionState<ConfirmState, FormData>(resendCode, {})
  // Countdown: a tick counter and the tick at which "send again" opens. The code was sent a moment ago, so the
  // first resend opens after a minute; the server enforces the same rule.
  const [tick, setTick] = useState(0)
  const [opensAt, setOpensAt] = useState(60)
  const [seen, setSeen] = useState(again)
  if (seen !== again) {
    setSeen(again)
    if (again.retryIn) setOpensAt(tick + again.retryIn)
  }
  const wait = Math.max(0, opensAt - tick)
  const done = state.done ?? again.done
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  // A hard navigation, so the new state is read by the proxy and the server components.
  useEffect(() => { if (done) window.location.assign(done) }, [done])

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(() => verify(data))
  }
  const error = state.error ?? again.error

  return (
    <div className="flex flex-col gap-6">
      <form action={verify} onSubmit={onSubmit} className="flex flex-col gap-5">
        <input type="hidden" name="next" value={next} />
        <div className="grid gap-2">
          <label htmlFor="code" className="t-label !text-fg">6-digit code</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} required autoFocus
            aria-invalid={state.error ? true : undefined} aria-describedby={error ? 'code-err' : undefined} placeholder="000000"
            className="h-16 w-full rounded-xl border-2 border-field bg-white px-4 text-center font-heading text-[28px] font-bold tabular-nums tracking-[0.35em] text-fg outline-none placeholder:text-field/50 focus:border-primary focus:ring-4 focus:ring-accent/55 sm:max-w-[300px]" />
          {error && <p id="code-err" role="alert" className="t-label flex items-start gap-2 !text-fg"><Icon name="info" className="mt-px h-5 w-5 shrink-0 text-primary" />{error}</p>}
        </div>
        <button className={`${buttonLg} w-full`} disabled={verifying || Boolean(done)}>{verifying || done ? 'Checking…' : 'Confirm email'}</button>
      </form>

      <form action={resend} className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="t-small" role="status">
          {again.resent ? 'A new code is on its way.' : 'Did not get it? Look in spam first.'}
        </p>
        <button type="submit" disabled={wait > 0 || resending} className="inline-flex min-h-11 items-center t-label !text-primary underline underline-offset-4 disabled:!text-mute disabled:no-underline">
          {wait > 0 ? <>Send again in <span className="tnum ml-1">{Math.floor(wait / 60)}:{String(wait % 60).padStart(2, '0')}</span></> : resending ? 'Sending…' : 'Send a new code'}
        </button>
      </form>
      <form action="/logout" method="post">
        <input type="hidden" name="next" value="/signup" />
        <button type="submit" className="inline-flex min-h-11 items-center t-label !text-fg underline underline-offset-4">Use a different email</button>
      </form>
    </div>
  )
}
