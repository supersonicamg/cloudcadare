'use client'

import { useActionState, useOptimistic, useState, useTransition, type ReactNode } from 'react'
import { Icon } from '@educore/ui/marks'
import { buttonLg, buttonOutline } from '@/lib/ui'
import { changePassword, endOtherSessions, endSession, saveProfile, setReminder, type FormState, type ReminderKey } from './actions'

const field = 'h-12 w-full rounded-xl border-2 border-field bg-white px-4 t-body !text-fg outline-none focus:border-primary focus:ring-4 focus:ring-accent/55 read-only:border-border read-only:bg-muted read-only:!text-grey'

function Field({ name, label, state, hint, optional, type = 'text', ...rest }: {
  name: string; label: string; state: FormState; hint?: ReactNode; optional?: boolean; type?: string
  defaultValue?: string; readOnly?: boolean; autoComplete?: string; inputMode?: 'tel' | 'text'; maxLength?: number; required?: boolean
}) {
  const error = state.field === name ? state.error : undefined
  const note = error ? `${name}-err` : hint ? `${name}-hint` : undefined
  return (
    <div className="grid content-start gap-2">
      <label htmlFor={name} className="t-label !text-fg">{label}{optional && <span className="font-normal text-mute"> (optional)</span>}</label>
      <input id={name} name={name} type={type} aria-invalid={error ? true : undefined} aria-describedby={note} className={field} {...rest} />
      {error ? <p id={`${name}-err`} role="alert" className="t-label flex items-start gap-2 !text-fg"><Icon name="info" className="mt-px h-4 w-4 shrink-0 text-primary" />{error}</p>
        : hint && <p id={`${name}-hint`} className="t-small">{hint}</p>}
    </div>
  )
}

/** Result line under a form. Failure that is not about one field shows here, in ink on stone, with what to do next. */
function Result({ state }: { state: FormState }) {
  if (state.ok) return <p role="status" className="t-label flex items-center gap-2 !text-deep"><Icon name="check" className="h-5 w-5" />{state.ok}</p>
  if (state.error && !state.field) return <p role="alert" className="t-label flex items-start gap-2 !text-fg"><Icon name="info" className="mt-px h-5 w-5 shrink-0 text-primary" />{state.error}</p>
  return null
}

export function ProfileForm({ name, whatsapp, email, city, certificateName, certificateLocked }: {
  name: string; whatsapp: string; email: string; city: string; certificateName: string; certificateLocked: boolean
}) {
  const [state, action, pending] = useActionState(saveProfile, {})
  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="name" label="Full name" state={state} defaultValue={name} autoComplete="name" required maxLength={80} />
        <Field name="whatsapp" label="WhatsApp number" state={state} defaultValue={whatsapp} type="tel" inputMode="tel" autoComplete="tel" hint="We message you here about classes and payments." />
        <Field name="email" label="Email" state={state} defaultValue={email} readOnly hint="To change it, go to Password and devices." />
        <Field name="city" label="City" optional state={state} defaultValue={city} autoComplete="address-level2" maxLength={60} />
      </div>
      <Field name="certificate_name" label="Name on your certificate" state={state} defaultValue={certificateName} readOnly={certificateLocked} maxLength={80}
        hint={certificateLocked ? 'Locked. Your certificate has been issued.' : 'Check the spelling. It cannot be changed after your certificate is issued.'} />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-1">
        <button className={buttonLg} disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</button>
        <Result state={state} />
      </div>
    </form>
  )
}

/** A real switch: a button with role="switch", saved as soon as it is pressed (optimistic, then confirmed). */
export function ReminderSwitch({ id, title, detail, on }: { id: ReminderKey; title: string; detail: string; on: boolean }) {
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
    <li className="flex items-center justify-between gap-5 border-b border-border py-3.5">
      <div className="min-w-0">
        <p id={`${id}-t`} className="t-label !text-fg">{title}</p>
        <p className="t-small">{detail}{msg && <span role="status" className="ml-2 font-semibold text-deep">{msg}</span>}</p>
      </div>
      <button type="button" role="switch" aria-checked={value} aria-labelledby={`${id}-t`} onClick={toggle} disabled={pending}
        className="relative h-11 w-[68px] shrink-0 rounded-full">
        <span aria-hidden="true" className={`absolute left-0 top-1/2 block h-7 w-[52px] -translate-y-1/2 rounded-full transition-colors ${value ? 'bg-primary' : 'bg-[#C9CCC7]'}`} />
        <span aria-hidden="true" className={`absolute left-[3px] top-1/2 block h-[22px] w-[22px] -translate-y-1/2 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${value ? 'translate-x-[24px]' : ''}`} />
      </button>
    </li>
  )
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, {})
  return (
    <form action={action} className="grid gap-5">
      <div className="max-w-sm"><Field name="current" label="Current password" state={state} type="password" autoComplete="current-password" required /></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="next" label="New password" state={state} type="password" autoComplete="new-password" hint="At least 8 characters." required />
        <Field name="again" label="Repeat new password" state={state} type="password" autoComplete="new-password" required />
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-1">
        <button className={buttonLg} disabled={pending}>{pending ? 'Updating…' : 'Update password'}</button>
        <Result state={state} />
      </div>
    </form>
  )
}

export function EndSessionButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  return (
    <span className="flex flex-col items-end gap-1">
      <button type="button" disabled={pending} aria-label={label} className={`${buttonOutline} !h-11`}
        onClick={() => start(async () => { const r = await endSession(id); if (r.error) setErr(r.error) })}>
        {pending ? 'Logging out…' : 'Log out'}
      </button>
      {err && <span role="alert" className="t-small">{err}</span>}
    </span>
  )
}

export function EndOthersButton() {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <button type="button" disabled={pending} className={buttonOutline}
        onClick={() => start(async () => { const r = await endOtherSessions(); setMsg(r.error ?? r.ok ?? null) })}>
        {pending ? 'Logging out…' : 'Log out of all other devices'}
      </button>
      {msg && <span role="status" className="t-label">{msg}</span>}
    </div>
  )
}
