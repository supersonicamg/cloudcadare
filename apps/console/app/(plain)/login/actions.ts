'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerDb, getPlane, hasPlaneEnv } from '@educore/auth'
import { describeAuthError, parseLogin, parseSignUp, safeNext, type AccountError } from '@educore/core/accounts'

export type AuthState = Partial<AccountError>

const NOT_CONFIGURED = { error: 'Sign-in is not configured in this environment yet.' }

export async function signUp(_p: AuthState, form: FormData): Promise<AuthState> {
  const parsed = parseSignUp(form)
  if (!parsed.ok) return { error: parsed.error, field: parsed.field }
  if (!hasPlaneEnv()) return NOT_CONFIGURED
  const db = createServerDb(getPlane(null), await cookies())
  const { name, email, password, whatsapp } = parsed.data
  const { data, error } = await db.auth.signUp({ email, password, options: { data: { full_name: name, whatsapp } } })
  if (error) return describeAuthError(error, 'signup')
  if (!data.session) {
    console.error('sign-up returned no session: turn off "Confirm email" in the Supabase project (Authentication > Sign In / Providers > Email)')
    return { error: 'Sign-up is not fully set up yet.' }
  }
  redirect(safeNext(form.get('next')))
}

export async function signIn(_p: AuthState, form: FormData): Promise<AuthState> {
  const parsed = parseLogin(form)
  if (!parsed.ok) return { error: parsed.error, field: parsed.field }
  if (!hasPlaneEnv()) return NOT_CONFIGURED
  const db = createServerDb(getPlane(null), await cookies())
  const { error } = await db.auth.signInWithPassword(parsed.data)
  if (error) return describeAuthError(error, 'login')
  redirect(safeNext(form.get('next')))
}
