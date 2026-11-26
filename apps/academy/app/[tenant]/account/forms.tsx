'use client'

import { useActionState, useOptimistic, useState, useTransition, type ReactNode } from 'react'
import { Ic } from '../_components/v11'
import { CertMini } from './ui'
import { changePassword, endOtherSessions, endSession, saveProfile, setReminder, type FormState, type ReminderKey } from './actions'

function Field({ name, label, state, hint, optional, type = 'text', full, wide, onText, ...rest }: {
  name: string; label: string; state: FormState; hint?: ReactNode; optional?: boolean; type?: string; full?: boolean; wide?: boolean
  onText?: (v: string) => void
  defaultValue?: string; readOnly?: boolean; autoComplete?: string; inputMode?: 'tel' | 'text'; maxLength?: number; required?: boolean
}) {
  const error = state.field === name ? state.error : undefined
  const note = error ? `${name}-err` : hint ? `${name}-hint` : undefined
  const [shown, setShown] = useState(false)
  const secret = type === 'password'
  const input = (
    <input id={name} name={name} className="in" type={secret && shown ? 'text' : type} aria-invalid={error ? true : undefined} aria-describedby={note}
      onChange={onText ? (e) => onText(e.target.value) : undefined} {...rest} />
  )
  return (
    <div className={`fld${full ? ' full' : ''}`} style={wide ? { maxWidth: 360 } : undefined}>
      <label htmlFor={name}>{label}{optional && <> <small>(optional)</small></>}</label>
      {secret
        ? <div className="pw">{input}<button type="button" onClick={() => setShown((s) => !s)} aria-controls={name}>{shown ? 'Hide' : 'Show'}</button></div>
        : input}
      {error ? <p id={`${name}-err`} role="alert" className="err"><Ic n="info" s />{error}</p>
        : hint && <p id={`${name}-hint`} className="hint">{hint}</p>}
    </div>
  )
}

/** Result line next to the button. A failure that is not about one field shows here too, in ink, with what to do next. */
function Result({ state }: { state: FormState }) {
  if (state.ok) return <p role="status" className="ok-line"><Ic n="check" s />{state.ok}</p>
  if (state.error && !state.field) return <p role="alert" className="ok-line"><Ic n="info" s />{state.error}</p>
  return null
}

export function ProfileForm({ name, whatsapp, email, city, certificateName, certificateLocked, mark, program, hintLink }: {
  name: string; whatsapp: string; email: string; city: string; certificateName: string; certificateLocked: boolean
  mark: ReactNode; program: string | null; hintLink: ReactNode
}) {
  const [state, action, pending] = useActionState(saveProfile, {})
  const [cert, setCert] = useState(certificateName)
  return (
    <form action={action} className="fgrid">
      <Field name="name" label="Full name" state={state} defaultValue={name} autoComplete="name" required maxLength={80} />
      <Field name="whatsapp" label="WhatsApp number" state={state} defaultValue={whatsapp} type="tel" inputMode="tel" autoComplete="tel" hint="We message you here about classes and payments." />
      <Field name="email" label="Email" state={state} defaultValue={email} readOnly hint={hintLink} />
      <Field name="city" label="City" optional state={state} defaultValue={city} autoComplete="address-level2" maxLength={60} />
      <div className="full certrow">
        <Field name="certificate_name" label="Name on your certificate" state={state} defaultValue={certificateName} readOnly={certificateLocked} maxLength={80} onText={setCert}
          hint={certificateLocked ? 'Locked. Your certificate has been issued.' : 'Check the spelling. It cannot be changed after your certificate is issued.'} />
        <CertMini mark={mark} name={cert || ' '} program={program} />
      </div>
      <div className="full form-act">
        <button className="btn" disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</button>
        <Result state={state} />
      </div>
    </form>
  )
}

/** A real switch: a button with role="switch", saved as soon as it is pressed (optimistic, then confirmed). */
export function ReminderSwitch({ id, title, detail, on, channel }: { id: ReminderKey; title: string; detail: string; on: boolean; channel: 'whatsapp' | 'email' }) {
  const [value, setValue] = useOptimistic(on, (_s, next: boolean) => next)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const toggle = () => {
    const next = !value
    setMsg(null)
    start(async () => {
      setValue(next)
      const r = await setReminder(id, next)
      setMsg(r.error ?? 'Saved')
    })
  }
  return (
    <li className="swrow">
      <span className="ti">{channel === 'whatsapp' ? <svg className="wa" aria-hidden="true" focusable="false"><use href="#i-wa" /></svg> : <Ic n="mail" />}</span>
      <span className="tx">
        <b className="t-card" id={`${id}-t`}>{title}</b>
        <span className="t-label">{detail}{msg && <> · <span role="status">{msg}</span></>}</span>
      </span>
      <button type="button" className="sw" role="switch" aria-checked={value} aria-labelledby={`${id}-t`} onClick={toggle} disabled={pending} />
    </li>
  )
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, {})
  return (
    <form action={action} className="fgrid">
      <Field name="current" label="Current password" state={state} type="password" autoComplete="current-password" required full wide />
      <Field name="next" label="New password" state={state} type="password" autoComplete="new-password" hint="At least 8 characters." required />
      <Field name="again" label="Type it again" state={state} type="password" autoComplete="new-password" required />
      <div className="full form-act">
        <button className="btn" disabled={pending}>{pending ? 'Updating…' : 'Update password'}</button>
        <Result state={state} />
      </div>
    </form>
  )
}

export function EndSessionButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  return (
    <span style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
      <button type="button" disabled={pending} aria-label={label} className="btn btn-line btn-sm"
        onClick={() => start(async () => { const r = await endSession(id); if (r.error) setErr(r.error) })}>
        {pending ? 'Logging out…' : 'Log out'}
      </button>
      {err && <span role="alert" className="t-label">{err}</span>}
    </span>
  )
}

export function EndOthersButton() {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <p style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 20px' }}>
      <button type="button" disabled={pending} className="link link-s"
        onClick={() => start(async () => { const r = await endOtherSessions(); setMsg(r.error ?? r.ok ?? null) })}>
        {pending ? 'Logging out…' : 'Log out of all other devices'}
      </button>
      {msg && <span role="status" className="t-label">{msg}</span>}
    </p>
  )
}
