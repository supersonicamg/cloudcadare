'use client'

import { signIn } from './actions'
import { CourseContext, Field, FormError, useAuthForm, type LoginContext } from './auth-fields'

/** `forgotHref`: the academy's WhatsApp link, or null when it has no number (then the line only says to contact the academy). */
export function LoginForm({ next, context, forgotHref }: { next: string; context?: LoginContext; forgotHref: string | null }) {
  const { state, pending, formProps } = useAuthForm(signIn)
  return (
    <form {...formProps} className="auth-box">
      {context && <CourseContext context={context} intro="Log in to continue with" />}
      <div>
        <h1 className="t-title">{context ? 'Log in to buy this course' : 'Log in'}</h1>
        <p className="t-lead" style={{ marginTop: 8 }}>Your lessons are where you left them.</p>
      </div>
      <input type="hidden" name="next" value={next} />
      <Field state={state} name="email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" />
      <Field state={state} name="password" label="Password" type="password" autoComplete="current-password" />
      <FormError state={state} />
      <button className="btn btn-full" disabled={pending}>{pending ? 'Logging in…' : 'Log in'}</button>
      <p className="t-small">
        Forgot your password?{' '}
        {forgotHref
          ? <a className="link link-s" href={forgotHref} target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a>
          : 'Contact the academy and they will reset it.'}
      </p>
    </form>
  )
}
