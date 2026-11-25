import { z } from 'zod'
import { handleWebhook } from '@educore/core/commerce'
import { resolveTenantFromHost } from '@/lib/dal'
import { kickOutbox } from '@/lib/outbox'

// Razorpay -> us. No cookies, no session: the HMAC signature over the raw body is the authentication.
// The URL carries the tenant id and must match the academy this host belongs to.

export async function POST(request: Request, { params }: RouteContext<'/[tenant]/api/webhooks/razorpay/[tenantId]'>) {
  const { tenantId } = await params
  if (!z.uuid().safeParse(tenantId).success) return Response.json({ ok: false }, { status: 404 })
  const bundle = await resolveTenantFromHost()
  if (!bundle || bundle.tenant.id !== tenantId) return Response.json({ ok: false }, { status: 404 })

  const raw = await request.text()
  if (raw.length > 100_000) return Response.json({ ok: false }, { status: 413 })
  const out = await handleWebhook(tenantId, raw, request.headers)
  if (out.status === 200 && out.body.note === 'paid') kickOutbox()
  return Response.json(out.body, { status: out.status, headers: { 'Cache-Control': 'no-store' } })
}
