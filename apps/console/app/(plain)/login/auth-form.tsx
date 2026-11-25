'use client'

import Link from 'next/link'
import { startTransition, useActionState, type FormEvent, type InputHTMLAttributes } from 'react'
import type { AccountField } from '@educore/core/accounts'
import { button, input } from '@/lib/ui'
import { signIn, signUp, type AuthState } from './actions'

function Field({ name, label, hint, state, ...rest }: InputHTMLAttributes<HTMLInputElement> & { name: AccountField; label: string; hint?: string; state: AuthState }) {
  const error = state.field === name ? state.error : undefined
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium">{label}</label>
      <input id={name} name={name} required className={input} aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${name}-note` : undefined} {...rest} />
      {(error || hint) && (
        <p id={`${name}-note`} role={error ? 'alert' : undefined} className={`mt-1 text-sm ${error ? 'text-danger' : 'text-fg/60'}`}>{error ?? hint}</p>
      )}
    </div>
  )
}

export function AuthForm({ mode, next }: { mode: 'login' | 'signup'; next: string }) {
  const creating = mode === 'signup'
  const [state, dispatch, pending] = useActionState<AuthState, FormData>(creating ? signUp : signIn, {})
  // Not reset after a rejected attempt; `action` stays set so an early submit is still a POST.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(() => dispatch(data))
  }
  const other = `${creating ? '/login' : '/signup'}${next === '/' ? '' : `?next=${encodeURIComponent(next)}`}`
  return (
    <form action={dispatch} onSubmit={onSubmit} className="max-w-sm space-y-4">
      <input type="hidden" name="next" value={next} />
      {creating && <Field state={state} name="name" label="Full name" autoComplete="name" maxLength={80} />}
      <Field state={state} name="email" label="Email" type="email" autoComplete="email" />
      {creating && <Field state={state} name="whatsapp" label="WhatsApp number" type="tel" autoComplete="tel" hint="Outside India, start with + and your country code." />}
      <Field state={state} name="password" label="Password" type="password" autoComplete={creating ? 'new-password' : 'current-password'}
        hint={creating ? 'At least 8 characters.' : undefined} />
      {state.error && !state.field && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button className={button} disabled={pending}>{pending ? 'Please wait…' : creating ? 'Create account' : 'Sign in'}</button>
      <p className="text-sm text-fg/70">
        {creating ? 'Already have an account? ' : 'New here? '}
        <Link href={other} className="text-primary underline">{creating ? 'Sign in' : 'Create an account'}</Link>
      </p>
    </form>
  )
}
