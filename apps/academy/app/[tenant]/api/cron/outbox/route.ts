import { timingSafeEqual } from 'node:crypto'
import { processOutbox } from '@educore/core/notifications'
import { tenantOrigin } from '@/lib/outbox'

// Called by a scheduler (Vercel Cron, an uptime pinger, a Supabase cron job) every minute or so. It mails whatever the
// app queued and could not send right away. Needs CRON_SECRET; without it the route does not exist.

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const ok = Boolean(secret) && given.length === secret!.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret!))
  if (!ok) return new Response('Not found', { status: 404 })
  const r = await processOutbox({ limit: 50, origin: tenantOrigin })
  return Response.json(r, { headers: { 'Cache-Control': 'no-store' } })
}
