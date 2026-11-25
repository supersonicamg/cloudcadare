'use client'

import Link from 'next/link'
import { buttonLg, hint } from '@/lib/ui'
import { signIn } from './actions'
import { CourseContext, Field, FormError, heading, lead, swapLine, swapLink, useAuthForm, withNext, type LoginContext } from './auth-fields'

export function LoginForm({ next, context }: { next: string; context?: LoginContext }) {
  const { state, pending, formProps } = useAuthForm(signIn)
  return (
    <form {...formProps} className="flex flex-col gap-[22px]">
      {context && <CourseContext context={context} intro="Log in to continue with" />}
      <div>
        <h1 className={heading}>{context ? 'Log in to buy this course' : 'Log in'}</h1>
        <p className={lead}>Use your email and password.</p>
      </div>
      <input type="hidden" name="next" value={next} />
      <Field state={state} name="email" label="Email address" type="email" autoComplete="email" placeholder="you@example.com" />
      <Field state={state} name="password" label="Password" type="password" autoComplete="current-password" />
      <FormError state={state} />
      <button className={`${buttonLg} w-full`} disabled={pending}>{pending ? 'Logging in…' : 'Log in'}</button>
      <p className={swapLine}>New to us? <Link href={withNext('/signup', next)} className={swapLink}>Create an account</Link></p>
      <p className={hint}>Forgot your password? Message us on WhatsApp and we will reset it.</p>
    </form>
  )
}
