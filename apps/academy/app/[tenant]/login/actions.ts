'use server'

import { cookies, headers } from 'next/headers'
import { createServerDb, getPlane, hasPlaneEnv } from '@educore/auth'
import { describeAuthError, parseLogin, parseSignUp, safeNext, type AccountError } from '@educore/core/accounts'
import { domainMapFromEnv, resolveHost } from '@educore/tenancy'
import { loadTenantBundle } from '@educore/tenancy/privileged/load-tenant'

// Server actions cannot read root params, so the tenant comes from the Host header via the same
// resolver proxy.ts uses. The client never tells us which academy it is signing in to.

export type AuthState = Partial<AccountError> & { done?: string }

async function currentTenant() {
  const host = (await headers()).get('host')
  const r = await resolveHost(host, {
    baseDomain: process.env.BASE_DOMAIN ?? 'localhost',
    map: domainMapFromEnv(),
    strict: Boolean(process.env.UPSTASH_REDIS_REST_URL),
  })
  if (r.kind !== 'tenant') return null
  return loadTenantBundle(r.slug)
}

async function connect() {
  if (!hasPlaneEnv()) return { error: 'Sign-in is not configured in this environment yet.' }
  const tenant = await currentTenant()
  if (!tenant) return { error: 'This academy is not available.' }
  // Forward the visitor's browser name so "Where you are logged in" shows their device, not this server.
  const ua = (await headers()).get('user-agent')?.slice(0, 300)
  return { tenantId: tenant.tenant.id, db: createServerDb(getPlane(tenant.tenant.planeId), await cookies(), ua ? { headers: { 'User-Agent': ua } } : undefined) }
}

type Connection = Exclude<Awaited<ReturnType<typeof connect>>, { error: string }>

/** First sign-in on this academy creates the membership (public.join_tenant: idempotent, honours closed signup). */
async function join({ db, tenantId }: Connection, fullName: unknown, next: FormDataEntryValue | null): Promise<AuthState> {
  const name = typeof fullName === 'string' ? fullName.trim().slice(0, 80) : ''
  const { error } = await db.rpc('join_tenant', { p_tenant_id: tenantId, p_display_name: name || undefined })
  if (!error) return { done: safeNext(next) }
  await db.auth.signOut()
  return {
    error: error.message.includes('signup_closed')
      ? 'This academy is invitation-only.'
      : error.message.includes('member_blocked')
        ? 'This account cannot sign in here. Contact the academy.'
        : 'We could not finish signing you in.',
  }
}

export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = parseSignUp(form)
  if (!parsed.ok) return { error: parsed.error, field: parsed.field }
  const c = await connect()
  if ('error' in c) return c

  const { name, email, password, whatsapp } = parsed.data
  const { data, error } = await c.db.auth.signUp({ email, password, options: { data: { full_name: name, whatsapp } } })
  if (error) return describeAuthError(error, 'signup')
  if (!data.session) {
    // Only happens when the project still asks for email confirmation, which cannot work without a mail server.
    console.error('sign-up returned no session: turn off "Confirm email" in the Supabase project (Authentication > Sign In / Providers > Email)')
    return { error: 'Sign-up is not fully set up yet. Contact the academy.' }
  }
  return join(c, name, form.get('next'))
}

export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = parseLogin(form)
  if (!parsed.ok) return { error: parsed.error, field: parsed.field }
  const c = await connect()
  if ('error' in c) return c

  const { data, error } = await c.db.auth.signInWithPassword(parsed.data)
  if (error) return describeAuthError(error, 'login')
  return join(c, data.user.user_metadata.full_name, form.get('next'))
}
