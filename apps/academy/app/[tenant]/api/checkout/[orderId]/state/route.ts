import { cookies } from 'next/headers'
import { z } from 'zod'
import { createServerDb, getPlane } from '@educore/auth'
import { resolveTenantFromHost } from '@/lib/dal'

// "Has my payment been checked yet?" for the waiting page (polled every 20 s). Read-only, own orders only: the
// user-scoped client means row-level security decides what this person may see, so another learner's order is a 404.

const json = (status: number, data: unknown) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  if (!z.uuid().safeParse(orderId).success) return json(404, { error: 'not_found' })
  const bundle = await resolveTenantFromHost()
  if (!bundle) return json(404, { error: 'not_found' })
  const db = createServerDb(getPlane(bundle.tenant.planeId), await cookies())
  const { data: claims } = await db.auth.getClaims()
  if (!claims?.claims) return json(401, { error: 'signed_out' })

  const [order, proof] = await Promise.all([
    db.from('orders').select('status').eq('id', orderId).maybeSingle(),
    db.from('payment_proofs').select('state').eq('order_id', orderId).order('submitted_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (!order.data) return json(404, { error: 'not_found' })
  // One short word the page compares with what it already shows.
  return json(200, { key: `${order.data.status}:${proof.data?.state ?? 'none'}` })
}
