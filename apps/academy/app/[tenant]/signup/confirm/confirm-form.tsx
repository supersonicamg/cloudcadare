'use client'

import { startTransition, useActionState, useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Ic } from '../../_components/v11'
import { resendCode, verifyCode, type ConfirmState } from './actions'

const LENGTH = 6
const blank = () => Array<string>(LENGTH).fill('')

/**
 * Six boxes for the code (plan/16 §4.1). A paste, the phone's one-time-code suggestion or one long fill spreads over
 * all six; the server still receives one value (the hidden `code` field), so the form works the same as a single input.
 */
export function ConfirmForm({ next }: { next: string }) {
  const [state, verify, verifying] = useActionState<ConfirmState, FormData>(verifyCode, {})
  const [again, resend, resending] = useActionState<ConfirmState, FormData>(resendCode, {})
  const [digits, setDigits] = useState(blank)
  const boxes = useRef<Array<HTMLInputElement | null>>([])
  // Countdown: a tick counter and the tick at which "send again" opens. The code was sent a moment ago, so the
  // first resend opens after a minute; the server enforces the same rule.
  const [tick, setTick] = useState(0)
  const [opensAt, setOpensAt] = useState(60)
  const [seen, setSeen] = useState(again)
  if (seen !== again) {
    setSeen(again)
    if (again.retryIn) setOpensAt(tick + again.retryIn)
  }
  // After a refused code the boxes are emptied, so the learner starts the six again.
  const [seenVerify, setSeenVerify] = useState(state)
  if (seenVerify !== state) {
    setSeenVerify(state)
    if (state.error) setDigits(blank())
  }
  const wait = Math.max(0, opensAt - tick)
  const done = state.done ?? again.done
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => { if (state.error) boxes.current[0]?.focus() }, [state])
  // A hard navigation, so the new state is read by the proxy and the server components.
  useEffect(() => { if (done) window.location.assign(done) }, [done])

  /** Put `value` into the boxes from `from` on, then focus the box after the last digit. */
  function spread(from: number, value: string) {
    const only = value.replace(/\D/g, '').slice(0, LENGTH - from)
    if (!only) return
    setDigits((d) => d.map((c, i) => (i >= from && i < from + only.length ? only[i - from]! : c)))
    boxes.current[Math.min(from + only.length, LENGTH - 1)]?.focus()
  }
  function change(i: number, raw: string) {
    const only = raw.replace(/\D/g, '')
    if (!only) { setDigits((d) => d.map((c, j) => (j === i ? '' : c))); return }
    // Typing over a filled box keeps the newest digit; a longer value (paste, autofill) spreads.
    if (only.length === 2 && digits[i]) spread(i, only.slice(-1))
    else spread(i, only)
  }
  function key(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) boxes.current[i - 1]?.focus()
    if (e.key === 'ArrowLeft' && i > 0) boxes.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < LENGTH - 1) boxes.current[i + 1]?.focus()
  }
  function paste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    spread(i, e.clipboardData.getData('text'))
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(() => verify(data))
  }
  const error = state.error ?? again.error

  return (
    <>
      <form action={verify} onSubmit={onSubmit}>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="code" value={digits.join('')} />
        <fieldset aria-describedby={error ? 'code-err' : undefined}>
          <legend className="sr">6-digit code</legend>
          <div className="code">
            {digits.map((d, i) => (
              <input key={i} ref={(el) => { boxes.current[i] = el }} value={d} aria-label={`Digit ${i + 1}`}
                inputMode="numeric" pattern="[0-9]*" autoComplete={i === 0 ? 'one-time-code' : 'off'} autoFocus={i === 0}
                aria-invalid={state.error ? true : undefined}
                onChange={(e) => change(i, e.target.value)} onKeyDown={(e) => key(i, e)} onPaste={(e) => paste(i, e)}
                onFocus={(e) => e.currentTarget.select()} />
            ))}
          </div>
        </fieldset>
        {error && <p id="code-err" role="alert" className="ferr"><Ic n="info" s />{error}</p>}
        <button className="btn btn-full" disabled={verifying || Boolean(done)}>{verifying || done ? 'Checking…' : 'Confirm email'}</button>
      </form>

      <form action={resend}>
        <p className="t-small" role="status">
          {again.resent ? 'A new code is on its way. ' : 'No email after 2 minutes? Look in spam first, or '}
          <button type="submit" disabled={wait > 0 || resending} className="link link-s">
            {wait > 0 ? <>Send again in <span className="tnum">{Math.floor(wait / 60)}:{String(wait % 60).padStart(2, '0')}</span></> : resending ? 'Sending…' : 'send a new code'}
          </button>
        </p>
      </form>
      <form action="/logout" method="post">
        <input type="hidden" name="next" value="/signup" />
        <p className="t-small">Wrong email? <button type="submit" className="link link-s">Use a different email</button></p>
      </form>
    </>
  )
}
