'use client'

import { startTransition, useActionState, useEffect, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import type { AccountField } from '@educore/core/accounts'
import { Ic } from '../_components/v11'
import type { AuthState } from './actions'

export interface LoginContext { title: string }

/**
 * State and submit handling for a sign-in or sign-up form. The form is not reset after a rejected attempt (React
 * resets after a form action), and `action` stays set so a submit before the page is interactive is still a POST.
 */
export function useAuthForm(run: (state: AuthState, form: FormData) => Promise<AuthState>) {
  const [state, dispatch, pending] = useActionState<AuthState, FormData>(run, {})
  const done = state.done

  useEffect(() => {
    // Hard navigation so the new auth cookie is picked up by proxy and server components.
    if (done) window.location.assign(done)
  }, [done])

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(() => dispatch(data))
  }
  return { state, pending: pending || Boolean(done), formProps: { action: dispatch, onSubmit } }
}

export function ErrorLine({ id, children }: { id?: string; children: React.ReactNode }) {
  return <p id={id} role="alert" className="ferr"><Ic n="info" s />{children}</p>
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { name: AccountField; label: string; hint?: string; state: AuthState }

export function Field({ name, label, hint, state, type = 'text', ...rest }: FieldProps) {
  const [shown, setShown] = useState(false)
  const error = state.field === name ? state.error : undefined
  const secret = type === 'password'
  const described = error ? `${name}-error` : hint ? `${name}-hint` : undefined
  const input = (
    <input id={name} name={name} required type={secret && shown ? 'text' : type} aria-invalid={error ? true : undefined}
      aria-describedby={described} className="in" {...rest} />
  )
  return (
    <div className="fld">
      <label htmlFor={name}>{label}</label>
      {secret ? (
        <div className="pw">
          {input}
          <button type="button" onClick={() => setShown((s) => !s)} aria-controls={name} aria-pressed={shown}>{shown ? 'Hide' : 'Show'}</button>
        </div>
      ) : input}
      {error ? <ErrorLine id={`${name}-error`}>{error}</ErrorLine> : hint && <p id={`${name}-hint`} className="hint">{hint}</p>}
    </div>
  )
}

/** The course the visitor was heading to, so the page names it. */
export function CourseContext({ context, intro }: { context: LoginContext; intro: string }) {
  return (
    <p className="note-l"><Ic n="book" /><span>{intro} <b>{context.title}</b></span></p>
  )
}

/** An error that belongs to the whole form, not to one field. */
export function FormError({ state }: { state: AuthState }) {
  if (!state.error || state.field) return null
  if (state.error.includes('invitation-only')) {
    return (
      <p role="alert" className="note-l"><Ic n="info" /><span>This academy is invitation-only. Ask your counsellor to add your email.</span></p>
    )
  }
  return <ErrorLine>{state.error}</ErrorLine>
}
