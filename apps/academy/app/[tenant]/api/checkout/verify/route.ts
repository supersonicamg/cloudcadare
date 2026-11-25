import { cookies } from 'next/headers'
import { z } from 'zod'
import { createServerDb, getPlane } from '@educore/auth'
import { confirmCheckout } from '@educore/core/commerce'
import { resolveTenantFromHost } from '@/lib/dal'
import { kickOutbox } from '@/lib/outbox'

// The browser returns here after Razorpay Checkout. We do not trust it: the signature is verified with the
// academy's key secret and the amount that gets recorded is the order's own total.

const body = z.object({
  orderId: z.uuid(),
  razorpay_order_id: z.string().min(5).max(80),
  razorpay_payment_id: z.string().min(5).max(80),
  razorpay_signature: z.string().min(10).max(200),
})
const json = (status: number, data: unknown) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && new URL(origin).host !== request.headers.get('host')) return json(403, { error: 'forbidden' })
  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json(400, { error: 'bad_request' })

  const bundle = await resolveTenantFromHost()
  if (!bundle) return json(404, { error: 'not_found' })
  const db = createServerDb(getPlane(bundle.tenant.planeId), await cookies())
  const { data: claims } = await db.auth.getClaims()
  if (!claims?.claims) return json(401, { error: 'signed_out' })

  // RLS: a learner can read only their own orders, so this is also the ownership check.
  const { data: order } = await db.from('orders').select('id').eq('id', parsed.data.orderId).maybeSingle()
  if (!order) return json(404, { error: 'not_found' })

  const r = await confirmCheckout({
    tenantId: bundle.tenant.id, orderId: order.id, gatewayOrderId: parsed.data.razorpay_order_id,
    gatewayPaymentId: parsed.data.razorpay_payment_id, signature: parsed.data.razorpay_signature,
  })
  if (r.ok) { kickOutbox(); return json(200, { ok: true }) }
  return json(r.reason === 'bad_signature' ? 400 : r.reason === 'unknown_order' ? 404 : 502, { error: r.reason })
}
