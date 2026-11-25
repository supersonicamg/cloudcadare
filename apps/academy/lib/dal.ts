import 'server-only'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { createServerDb, getPlane } from '@educore/auth'
import { isEnabled, type FeatureKey } from '@educore/features'
import { check, type PermissionKey, type Principal } from '@educore/permissions'
import { domainMapFromEnv, resolveHost, type TenantBundle } from '@educore/tenancy'
import { loadTenantBundle } from '@educore/tenancy/privileged/load-tenant'
import { requireTenantBundle } from '@/lib/tenant'

// Data Access Layer for signed-in code. Every admin page and server action goes through requireAccess():
// tenant comes from the route or the Host header (never from client input), the user from a verified JWT,
// permissions from public.my_access, and data from the USER-SCOPED client so RLS is the last line of defence.

export interface Access {
  bundle: TenantBundle
  db: ReturnType<typeof createServerDb>
  userId: string
  memberId: string
  memberName: string
  principal: Principal
}

async function build(bundle: TenantBundle): Promise<Access | null> {
  const db = createServerDb(getPlane(bundle.tenant.planeId), await cookies())
  const { data } = await db.auth.getClaims()
  if (!data?.claims) return null
  const { data: raw } = await db.rpc('my_access', { p_tenant_id: bundle.tenant.id })
  const a = raw as { member_id: string; display_name: string; aal: 'aal1' | 'aal2'; permissions: string[] } | null
  if (!a) return null
  return {
    bundle, db, userId: data.claims.sub, memberId: a.member_id, memberName: a.display_name,
    principal: { permissions: new Set(a.permissions), features: bundle.features, aal: a.aal },
  }
}

/** Server Components: tenant from the [tenant] root param. Cached per request. */
export const getAccess = cache(async () => build(await requireTenantBundle()))

async function tenantFromHost(): Promise<TenantBundle | null> {
  const r = await resolveHost((await headers()).get('host'), {
    baseDomain: process.env.BASE_DOMAIN ?? 'localhost',
    map: domainMapFromEnv(),
    strict: Boolean(process.env.UPSTASH_REDIS_REST_URL),
  })
  return r.kind === 'tenant' ? loadTenantBundle(r.slug) : null
}

/** Signed in or not, nothing else. Cheap (JWT verified locally), safe for chrome such as the header link. */
export const getViewer = cache(async () => {
  const bundle = await requireTenantBundle()
  const db = createServerDb(getPlane(bundle.tenant.planeId), await cookies())
  const { data } = await db.auth.getClaims()
  const meta = (data?.claims?.user_metadata ?? {}) as { full_name?: string }
  return { signedIn: Boolean(data?.claims), email: data?.claims?.email, fullName: meta.full_name }
})

export interface Need { permission: PermissionKey; feature?: FeatureKey }

/** 'ok', or why not. 'mfa_required' means the member HAS the permission but this session is not at aal2. */
function authorise(access: Access, need: Need) {
  if (need.feature && !isEnabled(access.bundle.features, need.feature)) return 'feature_off' as const
  return check(access.principal, need.permission)
}

/** Pages: redirect to login when signed out, to the MFA step when a sensitive permission needs it, 404 otherwise. */
export async function requireAccess(need: Need, nextPath: string): Promise<Access> {
  const access = await getAccess()
  if (!access) redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  const verdict = authorise(access, need)
  if (verdict === 'mfa_required') redirect(`/admin/mfa?next=${encodeURIComponent(nextPath)}`)
  if (verdict !== 'ok') notFound()
  return access
}

export class ActionDenied extends Error {}
/** The member holds the permission, but the session needs the authenticator-app step first. */
export class MfaRequired extends ActionDenied {}

/** Server actions: no redirects, a typed denial the action turns into a message. */
export async function requireActionAccess(need: Need): Promise<Access> {
  const bundle = await tenantFromHost()
  const access = bundle ? await build(bundle) : null
  if (!access) throw new ActionDenied()
  const verdict = authorise(access, need)
  if (verdict === 'mfa_required') throw new MfaRequired()
  if (verdict !== 'ok') throw new ActionDenied()
  return access
}

/** Learner pages: any active member of this academy. Signed out goes to login, a non-member too. */
export async function requireMember(nextPath: string): Promise<Access> {
  const access = await getAccess()
  if (!access) redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  return access
}

/** Server actions for any member (no permission needed). */
export async function requireMemberAction(): Promise<Access> {
  const bundle = await tenantFromHost()
  const access = bundle ? await build(bundle) : null
  if (!access) throw new ActionDenied()
  return access
}

/** Route handlers: same as above but returns the tenant bundle so callers can answer 401 themselves. */
export const resolveTenantFromHost = tenantFromHost

/** Holds the permission at all, ignoring the MFA level. For menus: show the item, the page then asks for the code. */
export const holds = (a: Access, p: PermissionKey) => a.principal.permissions.has(p) || a.principal.permissions.has('*')

/** Can the current user do X? For showing or hiding UI only. */
export const can = (a: Access, p: PermissionKey) => check(a.principal, p) === 'ok'
