import { cookies, headers } from 'next/headers'
import { createServerDb, getPlane } from '@educore/auth'
import { resolveTenantFromHost } from '@/lib/dal'

// Log out (plan/16 §7): one click, no dialog, a plain form POST so it works without JavaScript.
// Ends THIS device's session only (scope 'local'); "log out of all other devices" lives under Password and devices.

export async function POST(request: Request) {
  // CSRF: a browser sends Origin on cross-site POSTs. Refuse any that does not match this host, so another site
  // cannot log a learner out by auto-submitting a form.
  const host = request.headers.get('host')
  const origin = request.headers.get('origin')
  if (origin && new URL(origin).host !== host) return new Response('Forbidden', { status: 403 })

  const bundle = await resolveTenantFromHost()
  if (bundle) {
    const db = createServerDb(getPlane(bundle.tenant.planeId), await cookies())
    await db.auth.signOut({ scope: 'local' })
  }
  const proto = (await headers()).get('x-forwarded-proto') ?? (host?.startsWith('localhost') || host?.includes('.localhost') ? 'http' : 'https')
  // 303: the browser follows a POST redirect with a GET.
  return new Response(null, { status: 303, headers: { Location: `${proto}://${host}/logged-out`, 'Cache-Control': 'no-store' } })
}
