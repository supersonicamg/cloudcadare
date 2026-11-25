import { cookies } from 'next/headers'
import { z } from 'zod'
import { createServerDb, getPlane } from '@educore/auth'
import { resolveTenantFromHost } from '@/lib/dal'

// "Join class". The database function decides: the learner must belong to the class, the link opens 10 minutes before the
// start and closes at the end, and attendance is recorded once. Only then is the person sent to the meeting link.

const noStore = { 'Cache-Control': 'private, no-store' }
// Redirects to our own pages are relative: behind a reverse proxy request.url holds the server's address, not the site's.
const to = (path: string) => new Response(null, { status: 303, headers: { Location: path, ...noStore } })
const back = (why: string) => to(`/dashboard?live=${why}`)

export async function GET(_request: Request, { params }: RouteContext<'/[tenant]/api/live/[sessionId]/join'>) {
  const { sessionId } = await params
  if (!z.uuid().safeParse(sessionId).success) return new Response('Not found', { status: 404, headers: noStore })
  const bundle = await resolveTenantFromHost()
  if (!bundle) return new Response('Not found', { status: 404, headers: noStore })
  const db = createServerDb(getPlane(bundle.tenant.planeId), await cookies())
  const { data: claims } = await db.auth.getClaims()
  if (!claims?.claims) return to(`/login?next=${encodeURIComponent('/dashboard')}`)

  const { data, error } = await db.rpc('join_live_session', { p_session: sessionId })
  if (error || !data) {
    const m = error?.message ?? ''
    return back(m.includes('not_open_yet') ? 'early' : m.includes('session_over') ? 'over' : 'unavailable')
  }
  // The meeting link was typed by staff: only web links are followed.
  if (!/^https?:\/\//i.test(data)) return back('unavailable')
  return new Response(null, { status: 302, headers: { Location: data, ...noStore } })
}
