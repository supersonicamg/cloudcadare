'use client'

import Link from 'next/link'
import { buttonLg, hint } from '@/lib/ui'
import { signIn } from './actions'
import { CourseContext, Field, FormError, heading, lead, swapLine, swapLink, useAuthForm, withNext, type LoginContext } from './auth-fields'

export function LoginForm({ next, context }: { next: string; context?: LoginContext }) {
  const { state, pending, formProps } = useAuthForm(signIn)
  return (
    <form {...formProps} className="flex flex-col gap-[22px]">
      {context && <CourseContext context={context} intro="Sign in to continue with" />}
      <div>
        <h1 className={heading}>{context ? 'Sign in to buy this course' : 'Welcome back'}</h1>
        <p className={lead}>Sign in with your email and password.</p>
      </div>
      <input type="hidden" name="next" value={next} />
      <Field state={state} name="email" label="Email address" type="email" autoComplete="email" placeholder="you@example.com" />
      <Field state={state} name="password" label="Password" type="password" autoComplete="current-password" />
      <FormError state={state} />
      <button className={`${buttonLg} w-full`} disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
      <p className={swapLine}>New here? <Link href={withNext('/signup', next)} className={swapLink}>Create an account</Link></p>
      <p className={hint}>Forgot your password? Ask the academy to reset it.</p>
    </form>
  )
}
