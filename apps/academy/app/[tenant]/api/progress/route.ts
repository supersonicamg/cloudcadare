import { cookies } from 'next/headers'
import { z } from 'zod'
import { createServerDb, getPlane } from '@educore/auth'
import { resolveTenantFromHost } from '@/lib/dal'
import { kickOutbox } from '@/lib/outbox'

// Learner heartbeat from the lesson player (every ~15 s, and on page close through sendBeacon).
// The database function validates membership, enrolment, the completion rule and caps the time delta,
// so this handler only authenticates, rejects cross-site posts and passes the numbers through.

const body = z.object({
  lessonId: z.uuid(),
  position: z.number().int().min(0).max(86_400).optional(),
  delta: z.number().int().min(0).max(120).optional(),
  pct: z.number().min(0).max(100).optional(),
  complete: z.boolean().optional(),
})

const json = (status: number, data: unknown) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(request: Request) {
  // CSRF: a browser always sends Origin on cross-site POSTs. Same-origin posts and sendBeacon match the Host.
  const origin = request.headers.get('origin')
  if (origin && new URL(origin).host !== request.headers.get('host')) return json(403, { error: 'forbidden' })

  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json(400, { error: 'bad_request' })

  const bundle = await resolveTenantFromHost()
  if (!bundle) return json(404, { error: 'not_found' })

  const db = createServerDb(getPlane(bundle.tenant.planeId), await cookies())
  const { data: claims } = await db.auth.getClaims()
  if (!claims?.claims) return json(401, { error: 'signed_out' })

  const { lessonId, position, delta, pct, complete } = parsed.data
  const { data, error } = await db.rpc('record_lesson_progress', {
    p_lesson_id: lessonId, p_position_seconds: position, p_delta_seconds: delta, p_progress_pct: pct, p_mark_complete: complete,
  })
  if (error) {
    // not_enrolled covers free previews: viewing is allowed, tracking is not.
    if (error.message.includes('not_enrolled')) return json(200, { tracked: false })
    if (error.message.includes('lesson_locked')) return json(409, { error: 'lesson_locked' })
    if (error.message.includes('lesson_not_found') || error.message.includes('not_a_member')) return json(404, { error: 'not_found' })
    return json(500, { error: 'failed' })
  }
  if ((data as { newly_completed?: boolean } | null)?.newly_completed) kickOutbox()
  return json(200, data)
}
