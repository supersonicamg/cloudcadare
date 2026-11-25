import { NextResponse, type NextRequest } from 'next/server'
import { getPlane, hasPlaneEnv, refreshSession } from '@educore/auth'
import { domainMapFromEnv, resolveHost } from '@educore/tenancy'

// Next 16 renamed middleware to proxy. Runs on every request before routing.
// Job: Host → tenant (edge map only, never Postgres), rewrite to /{slug}/…, refresh the auth cookie.

const PROTECTED = ['/dashboard', '/learn', '/admin', '/instructor', '/checkout', '/account']

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  const resolution = await resolveHost(request.headers.get('host'), {
    baseDomain: process.env.BASE_DOMAIN ?? 'localhost',
    map: domainMapFromEnv(),
    strict: Boolean(process.env.UPSTASH_REDIS_REST_URL),
  }).catch(() => ({ kind: 'unknown' as const })) // map outage: fail closed

  const url = request.nextUrl.clone()
  if (resolution.kind === 'unknown') {
    url.pathname = '/platform/unknown-host'
    return NextResponse.rewrite(url, { status: 404 })
  }
  if (resolution.kind === 'suspended') {
    url.pathname = '/platform/suspended'
    return NextResponse.rewrite(url, { status: 503 })
  }

  url.pathname = `/${resolution.slug}${pathname === '/' ? '' : pathname}`
  const response = NextResponse.rewrite(url)

  const claims = hasPlaneEnv() ? await refreshSession(request, response, getPlane(null)).catch(() => null) : null

  // Optimistic gate only. Every data read re-checks the session and permissions.
  if (!claims && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const login = request.nextUrl.clone()
    login.pathname = '/login'
    login.search = `?next=${encodeURIComponent(pathname + search)}`
    return NextResponse.redirect(login)
  }
  return response
}

export const config = {
  // Skip Next internals and files with an extension (favicon, images…).
  matcher: ['/((?!_next/|api/health|.*\\..*).*)'],
}
