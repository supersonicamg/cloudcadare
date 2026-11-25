'use server'

import { cookies, headers } from 'next/headers'
import { createServerDb, getPlane, hasPlaneEnv } from '@educore/auth'
import { describeAuthError, parseLogin, parseSignUp, safeNext, type AccountError } from '@educore/core/accounts'
import { sendEmailCode } from '@educore/core/accounts/privileged'
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
  return { tenantId: tenant.tenant.id, planeId: tenant.tenant.planeId, db: createServerDb(getPlane(tenant.tenant.planeId), await cookies(), ua ? { headers: { 'User-Agent': ua } } : undefined) }
}

type Connection = Exclude<Awaited<ReturnType<typeof connect>>, { error: string }>

/** First sign-in on this academy creates the membership (public.join_tenant: idempotent, honours closed signup). */
async function join({ db, tenantId }: Connection, fullName: unknown): Promise<{ memberId: string } | { error: string }> {
  const name = typeof fullName === 'string' ? fullName.trim().slice(0, 80) : ''
  const { data, error } = await db.rpc('join_tenant', { p_tenant_id: tenantId, p_display_name: name || undefined })
  if (!error && data) return { memberId: data }
  await db.auth.signOut()
  return {
    error: error?.message.includes('signup_closed')
      ? 'This academy is invitation-only.'
      : error?.message.includes('member_blocked')
        ? 'This account cannot sign in here. Contact the academy.'
        : 'We could not finish signing you in.',
  }
}

const confirmPath = (next: string) => `/signup/confirm${next === '/' ? '' : `?next=${encodeURIComponent(next)}`}`

/**
 * Where a signed-in person goes. A learner whose email is not confirmed yet, and who has neither access nor a staff role
 * (those were vetted another way), goes to the confirm step first and is sent a fresh code (the database throttles it).
 */
async function destination({ db, tenantId }: Connection, tenant: { planeId: string | null }, memberId: string, next: string): Promise<string> {
  const [m, enrolled, roles] = await Promise.all([
    db.from('tenant_members').select('email_verified_at').eq('id', memberId).single(),
    db.from('enrollments').select('id').eq('member_id', memberId).in('status', ['active', 'paused', 'completed']).limit(1),
    db.from('member_roles').select('member_id').eq('member_id', memberId).limit(1),
  ])
  // The dashboard is the signed-in default page; a safe `next` still wins. A learner-list match is never claimed here:
  // the dashboard shows it with "Join my batch now" (plan/16 §12).
  const home = next === '/' ? '/dashboard' : next
  if (roles.data?.length || m.data?.email_verified_at || enrolled.data?.length) return home
  await sendEmailCode({ memberId, tenantId, planeId: tenant.planeId }).catch((e) => console.error('email code failed:', e))
  return confirmPath(next)
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
  const joined = await join(c, name)
  if ('error' in joined) return joined
  // Nothing is granted until the email is confirmed (plan/16 §4.1): the code goes out now, whoever the address belongs to.
  await sendEmailCode({ memberId: joined.memberId, tenantId: c.tenantId, planeId: c.planeId }).catch((e) => console.error('email code failed:', e))
  return { done: confirmPath(safeNext(form.get('next'))) }
}

export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = parseLogin(form)
  if (!parsed.ok) return { error: parsed.error, field: parsed.field }
  const c = await connect()
  if ('error' in c) return c

  const { data, error } = await c.db.auth.signInWithPassword(parsed.data)
  if (error) return describeAuthError(error, 'login')
  const joined = await join(c, data.user.user_metadata.full_name)
  if ('error' in joined) return joined
  return { done: await destination(c, c, joined.memberId, safeNext(form.get('next'))) }
}
