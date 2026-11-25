'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createProofTarget, inspectProof, removeProof } from '@educore/core/commerce'
import { PROOF_EXTS, PROOF_MAX_BYTES, normaliseUtr } from '@educore/core/commerce/upi'
import { ActionDenied, requireMemberAction } from '@/lib/dal'

// The optional upload of the payment screenshot (plan/16 §5.2). The browser sends the file straight to private storage
// through a one-time URL; the server then looks at what really arrived and only then records it on the open proof.

export type ProofPrep = { error: string } | { target: { path: string; signedUrl: string } }
export interface ProofResult { ok?: boolean; error?: string }

const extOf = (name: string) => /\.([A-Za-z0-9]{1,5})$/.exec(name.trim())?.[1]?.toLowerCase() ?? ''

async function ownProof(orderId: string) {
  if (!z.uuid().safeParse(orderId).success) return null
  const a = await requireMemberAction()
  const { data } = await a.db.from('payment_proofs').select('id').eq('order_id', orderId).eq('member_id', a.memberId).eq('state', 'pending_review').maybeSingle()
  return data ? { a, proofId: data.id } : null
}

export async function prepareProofUpload(orderId: string, file: { name: string; size: number }): Promise<ProofPrep> {
  try {
    const own = await ownProof(orderId)
    if (!own) return { error: 'This payment is not waiting for a screenshot.' }
    const ext = extOf(String(file.name))
    if (!(PROOF_EXTS as readonly string[]).includes(ext)) return { error: 'Send a JPG, PNG or PDF.' }
    if (!(file.size > 0) || file.size > PROOF_MAX_BYTES) return { error: 'The file must be under 5 MB.' }
    const t = await createProofTarget(own.a.bundle.tenant.id, own.a.memberId, ext)
    return { target: { path: t.path, signedUrl: t.signedUrl } }
  } catch (e) {
    return { error: e instanceof ActionDenied ? 'Log in again to send it.' : 'Could not start the upload. Try again.' }
  }
}

/** `path` may be empty when the learner only types the bank reference. */
export async function finishProofUpload(orderId: string, path: string, utrRaw: string): Promise<ProofResult> {
  try {
    const own = await ownProof(orderId)
    if (!own) return { error: 'This payment is not waiting for a screenshot.' }
    const utr = normaliseUtr(String(utrRaw ?? ''))
    if (utr === null) return { error: 'The reference has 12 numbers. Check it, or leave it empty.' }
    const file = String(path ?? '')
    if (!file && !utr) return { error: 'Choose a screenshot or type the reference.' }
    if (file) {
      const seen = await inspectProof(own.a.bundle.tenant.id, own.a.memberId, file)
      if (!seen) { await removeProof(file); return { error: 'That file is not a picture or PDF, or it is over 5 MB.' } }
    }
    const { error } = await own.a.db.rpc('attach_payment_proof', { p_proof_id: own.proofId, p_file_path: file || null, p_utr: utr || null })
    if (error) {
      if (file) await removeProof(file)
      return { error: error.message.includes('utr_used') ? 'This reference was used on another order. Message us.' : error.message.includes('proof_closed') ? 'This payment was already checked.' : 'Could not save it. Try again.' }
    }
    revalidatePath(`/checkout/${orderId}/pending`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof ActionDenied ? 'Log in again to send it.' : 'Could not save it. Try again.' }
  }
}
