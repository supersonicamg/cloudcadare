'use client'

import { signUp } from '../login/actions'
import { CourseContext, Field, FormError, useAuthForm, type LoginContext } from '../login/auth-fields'

/** `facts`: the next batch, class times and fee from the academy's own content. They show above the form, so nobody signs up blind. */
export function SignUpForm({ next, context, facts }: { next: string; context?: LoginContext; facts?: Array<{ label: string; value: string; note?: string }> }) {
  const { state, pending, formProps } = useAuthForm(signUp)
  return (
    <form {...formProps} className="auth-box">
      {context && <CourseContext context={context} intro="Create an account to continue with" />}
      <div>
        <h1 className="t-title">Create your account</h1>
        <p className="t-lead" style={{ marginTop: 8 }}>Next you pick the batch and pay.</p>
      </div>
      {facts && facts.length > 0 && (
        <ul className="hfacts" aria-label="Next batch">
          {facts.map((f) => <li key={f.label}><span className="t-label">{f.label}</span><b className="t-card">{f.value}</b>{f.note && <span className="t-label">{f.note}</span>}</li>)}
        </ul>
      )}
      <input type="hidden" name="next" value={next} />
      <Field state={state} name="name" label="Full name" autoComplete="name" maxLength={80}
        hint="Write it the way you want it on your certificate." />
      <Field state={state} name="email" label="Email" type="email" autoComplete="email" placeholder="you@example.com" />
      <Field state={state} name="whatsapp" label="WhatsApp number" type="tel" autoComplete="tel" placeholder="98765 43210"
        hint="For class links and payment updates. Outside India, start with + and your country code." />
      {/* Length is checked on the server (and shown under the field); maxLength would silently cut a pasted password. */}
      <Field state={state} name="password" label="Password" type="password" autoComplete="new-password"
        hint="At least 8 characters." />
      <FormError state={state} />
      <button className="btn btn-full" disabled={pending}>{pending ? 'Creating your account…' : 'Create account'}</button>
    </form>
  )
}
