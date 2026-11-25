'use client'

import { startTransition, useActionState, useEffect, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { Icon, Logo } from '@educore/ui/marks'
import type { LogoKey } from '@educore/ui/theme'
import type { AccountField } from '@educore/core/accounts'
import { hint as hintClass, inputLg, label as labelClass } from '@/lib/ui'
import type { AuthState } from './actions'

export interface LoginContext { title: string; logo: LogoKey | null }

export const heading = 'font-heading text-[clamp(32px,3.4vw,44px)] font-extrabold leading-[1.04] tracking-[-0.04em] text-balance'
export const lead = 'mt-3 text-lg leading-relaxed text-grey'
export const swapLine = 'text-base text-grey'
export const swapLink = 'font-semibold text-primary underline underline-offset-4'

/** The /login or /signup address that keeps the page the visitor was heading to. */
export const withNext = (path: '/login' | '/signup', next: string) => (next === '/' ? path : `${path}?next=${encodeURIComponent(next)}`)

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
  return (
    <p id={id} role="alert" className="flex items-start gap-2 text-[15px] font-semibold leading-snug text-danger">
      <Icon name="info" className="mt-px h-5 w-5 shrink-0" />{children}
    </p>
  )
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { name: AccountField; label: string; hint?: string; state: AuthState }

export function Field({ name, label, hint, state, type = 'text', ...rest }: FieldProps) {
  const [shown, setShown] = useState(false)
  const error = state.field === name ? state.error : undefined
  const secret = type === 'password'
  const described = error ? `${name}-error` : hint ? `${name}-hint` : undefined
  return (
    <div className="grid gap-2">
      <label htmlFor={name} className={labelClass}>{label}</label>
      <div className="relative">
        <input id={name} name={name} required type={secret && shown ? 'text' : type} aria-invalid={error ? true : undefined}
          aria-describedby={described} className={`${inputLg} ${secret ? 'pr-20' : ''} ${error ? 'border-danger' : ''}`} {...rest} />
        {secret && (
          <button type="button" onClick={() => setShown((s) => !s)} aria-controls={name} aria-pressed={shown}
            className="absolute inset-y-0 right-0 rounded-r-xl px-4 text-[15px] font-semibold text-primary">
            {shown ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {error ? <ErrorLine id={`${name}-error`}>{error}</ErrorLine> : hint && <p id={`${name}-hint`} className={hintClass}>{hint}</p>}
    </div>
  )
}

export function CourseContext({ context, intro }: { context: LoginContext; intro: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-white p-2.5 pr-3.5 text-[15px] leading-tight">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tint-2">
        {context.logo ? <Logo name={context.logo} className="h-7 w-7" /> : <Icon name="book" className="h-6 w-6" />}
      </span>
      <div><span className="text-sm text-mute">{intro}</span><b className="block text-base">{context.title}</b></div>
    </div>
  )
}

/** An error that belongs to the whole form, not to one field. */
export function FormError({ state }: { state: AuthState }) {
  if (!state.error || state.field) return null
  if (state.error.includes('invitation-only')) {
    return (
      <div role="alert" className="flex items-center gap-3 rounded-2xl bg-danger-bg px-[18px] py-3.5 text-base font-medium leading-snug text-danger">
        <Icon name="info" className="h-[22px] w-[22px] shrink-0" />
        <span>This academy is invitation-only. Ask your counsellor to add your email.</span>
      </div>
    )
  }
  return <ErrorLine>{state.error}</ErrorLine>
}
