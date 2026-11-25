import { cookies } from 'next/headers'
import { z } from 'zod'
import { createServerDb, getPlane } from '@educore/auth'
import { isTeamsRecordingLink } from '@educore/core/media'
import { resolveTenantFromHost } from '@/lib/dal'

// A class recording left in Microsoft Teams (plan/16 §6.3). Row-level security on `lessons` decides whether this person
// may see it; the progress function then refuses a locked lesson and counts the opening as watched. Only then is the
// person sent to the link, and only to a Microsoft https address.

const noStore = { 'Cache-Control': 'private, no-store' }
// Redirects to our own pages are relative: behind a reverse proxy request.url holds the server's address, not the site's.
const go = (location: string) => new Response(null, { status: 303, headers: { Location: location, ...noStore } })

export async function GET(_request: Request, { params }: RouteContext<'/[tenant]/api/recording/[lessonId]'>) {
  const { lessonId } = await params
  if (!z.uuid().safeParse(lessonId).success) return new Response('Not found', { status: 404, headers: noStore })
  const bundle = await resolveTenantFromHost()
  if (!bundle) return new Response('Not found', { status: 404, headers: noStore })
  const db = createServerDb(getPlane(bundle.tenant.planeId), await cookies())
  const { data: claims } = await db.auth.getClaims()
  if (!claims?.claims) return go(`/login?next=${encodeURIComponent('/dashboard')}`)

  const { data: lesson } = await db.from('lessons').select('type, external_url')
    .eq('id', lessonId).eq('is_published', true).is('deleted_at', null).maybeSingle()
  if (!lesson || lesson.type !== 'live' || !lesson.external_url || !isTeamsRecordingLink(lesson.external_url)) {
    return new Response('Not found', { status: 404, headers: noStore })
  }
  const { error } = await db.rpc('record_lesson_progress', { p_lesson_id: lessonId })
  // A locked lesson stays shut. A free preview opened without an enrolment is not tracked, and opens.
  if (error?.message.includes('lesson_locked')) return go(`/dashboard?live=unavailable`)
  return go(lesson.external_url)
}
