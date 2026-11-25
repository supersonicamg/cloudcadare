import { cookies } from 'next/headers'
import { z } from 'zod'
import { createServerDb, getPlane } from '@educore/auth'
import { signedProofUrl } from '@educore/core/commerce'
import { resolveTenantFromHost } from '@/lib/dal'

// A payment screenshot. The bucket is private: this route first proves the person may see the PROOF (row-level security:
// the learner who sent it, or staff who verify or view orders), then redirects to a link that lasts one minute. The
// review screen points at this route, not at a signed link, so "open full size" still works after the page has been open a while.

const noStore = { 'Cache-Control': 'private, no-store' }

export async function GET(_req: Request, { params }: RouteContext<'/[tenant]/api/payment-proof/[proofId]'>) {
  const { proofId } = await params
  if (!z.uuid().safeParse(proofId).success) return new Response('Not found', { status: 404, headers: noStore })
  const bundle = await resolveTenantFromHost()
  if (!bundle) return new Response('Not found', { status: 404, headers: noStore })
  const db = createServerDb(getPlane(bundle.tenant.planeId), await cookies())
  const { data: claims } = await db.auth.getClaims()
  if (!claims?.claims) return new Response('Sign in first', { status: 401, headers: noStore })

  const { data: proof } = await db.from('payment_proofs').select('file_path, tenant_id').eq('id', proofId).eq('tenant_id', bundle.tenant.id).maybeSingle()
  if (!proof?.file_path) return new Response('Not found', { status: 404, headers: noStore })
  const url = await signedProofUrl(proof.file_path)
  if (!url) return new Response('Not found', { status: 404, headers: noStore })
  return new Response(null, { status: 302, headers: { Location: url, ...noStore } })
}
