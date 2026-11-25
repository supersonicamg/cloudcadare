'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ActionDenied, MfaRequired, requireActionAccess } from '@/lib/dal'
import { kickOutbox } from '@/lib/outbox'

const NEED = { permission: 'payment.verify', feature: 'commerce.checkout' } as const

export interface ReviewState {
  error?: string
  done?: 'approved' | 'rejected'
  /** What the database says happened, in words for staff. */
  message?: string
}

const REASONS = ['amount_mismatch', 'not_received', 'screenshot_unclear', 'wrong_account', 'duplicate'] as const

function problem(e: unknown): string {
  if (e instanceof MfaRequired) return 'This needs the two-step check first. Open Security, verify your code, then try again.'
  if (e instanceof ActionDenied) return 'You do not have permission to do that.'
  return 'Something went wrong. Try again.'
}

const dbError = (m: string) =>
  m.includes('mfa_required') ? problem(new MfaRequired())
  : m.includes('not_allowed') ? problem(new ActionDenied())
  : m.includes('own_order') ? 'You cannot verify your own payment. Ask a colleague.'
  : m.includes('money_not_seen') ? 'Tick “I can see this payment” first.'
  : m.includes('whatsapp_not_seen') ? 'Tick that you saw the screenshot on WhatsApp.'
  : m.includes('order_not_payable') ? 'This order is no longer open for payment.'
  : m.includes('proof_not_found') ? 'That payment was not found.'
  : 'Could not save. Try again.'

export async function approveProof(proofId: string, _prev: ReviewState, form: FormData): Promise<ReviewState> {
  const id = z.uuid().safeParse(proofId)
  if (!id.success) return { error: 'That payment was not found.' }
  try {
    const a = await requireActionAccess(NEED)
    const { data, error } = await a.db.rpc('approve_upi_payment', {
      p_proof: id.data, p_money_seen: form.get('money_seen') === 'on', p_whatsapp_seen: form.get('whatsapp_seen') === 'on',
    })
    if (error) return { error: dbError(error.message) }
    const r = data as { state: string; order_status: string; already: boolean }
    revalidatePath('/admin/payments/upi')
    kickOutbox()
    if (r.already) return { done: r.state === 'rejected' ? 'rejected' : 'approved', message: 'Someone already decided this payment. The list is up to date now.' }
    return {
      done: 'approved',
      message: r.order_status === 'paid' ? 'Verified. The order is paid and the learner has access. A receipt is on its way by email.' : 'Verified. Part of the order is paid; the learner can pay the rest.',
    }
  } catch (e) {
    return { error: problem(e) }
  }
}

export async function rejectProof(proofId: string, _prev: ReviewState, form: FormData): Promise<ReviewState> {
  const parsed = z.object({ id: z.uuid(), reason: z.enum(REASONS), note: z.string().trim().max(500) }).safeParse({
    id: proofId, reason: form.get('reason'), note: String(form.get('note') ?? ''),
  })
  if (!parsed.success) return { error: 'Choose a reason. The note can be up to 500 characters.' }
  try {
    const a = await requireActionAccess(NEED)
    const { data, error } = await a.db.rpc('reject_upi_payment', { p_proof: parsed.data.id, p_reason: parsed.data.reason, p_note: parsed.data.note || null })
    if (error) return { error: dbError(error.message) }
    const r = data as { state: string; already: boolean }
    revalidatePath('/admin/payments/upi')
    kickOutbox()
    if (r.already) return { done: r.state === 'approved' ? 'approved' : 'rejected', message: 'Someone already decided this payment. The list is up to date now.' }
    return { done: 'rejected', message: 'Sent back. The learner sees what to do next and gets an email.' }
  } catch (e) {
    return { error: problem(e) }
  }
}
