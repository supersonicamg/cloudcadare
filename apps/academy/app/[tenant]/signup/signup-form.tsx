'use client'

import Link from 'next/link'
import { buttonLg } from '@/lib/ui'
import { signUp } from '../login/actions'
import { CourseContext, Field, FormError, heading, lead, swapLine, swapLink, useAuthForm, withNext, type LoginContext } from '../login/auth-fields'

export function SignUpForm({ next, context }: { next: string; context?: LoginContext }) {
  const { state, pending, formProps } = useAuthForm(signUp)
  return (
    <form {...formProps} className="flex flex-col gap-[22px]">
      {context && <CourseContext context={context} intro="Create an account to continue with" />}
      <div>
        <h1 className={heading}>Create your account</h1>
        <p className={lead}>Use an email you can open now. We send a code to confirm it.</p>
      </div>
      <input type="hidden" name="next" value={next} />
      <Field state={state} name="name" label="Full name" autoComplete="name" maxLength={80}
        hint="Write it the way you want it on your certificate." />
      <Field state={state} name="email" label="Email address" type="email" autoComplete="email" placeholder="you@example.com" />
      <Field state={state} name="whatsapp" label="WhatsApp number" type="tel" autoComplete="tel" placeholder="98765 43210"
        hint="For class reminders and payment help. Outside India, start with + and your country code." />
      {/* Length is checked on the server (and shown under the field); maxLength would silently cut a pasted password. */}
      <Field state={state} name="password" label="Password" type="password" autoComplete="new-password"
        hint="At least 8 characters." />
      <FormError state={state} />
      <button className={`${buttonLg} w-full`} disabled={pending}>{pending ? 'Creating your account…' : 'Create account'}</button>
      <p className={swapLine}>Already have an account? <Link href={withNext('/login', next)} className={swapLink}>Log in</Link></p>
    </form>
  )
}
