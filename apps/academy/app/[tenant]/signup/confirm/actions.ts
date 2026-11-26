'use server'

import { safeNext } from '@educore/core/accounts'
import { sendEmailCode } from '@educore/core/accounts/privileged'
import { ActionDenied, requireMemberAction } from '@/lib/dal'

// Confirm the email with the 6-digit code (plan/16 §4). The code is created and mailed by the server; the database
// checks it (10 minutes, 5 tries, single use) and is the only thing that can mark the email as confirmed.

/** `help`: the error asks the learner to message the academy, so the form adds the WhatsApp link. */
export interface ConfirmState { error?: string; help?: boolean; done?: string; resent?: boolean; retryIn?: number }

export async function verifyCode(_prev: ConfirmState, form: FormData): Promise<ConfirmState> {
  const code = String(form.get('code') ?? '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(code)) return { error: 'Enter the 6 digits from the email.' }
  try {
    const a = await requireMemberAction()
    const { data, error } = await a.db.rpc('verify_email_code', { p_tenant_id: a.bundle.tenant.id, p_code: code })
    if (error) return { error: 'We could not check the code. Try again in a minute.' }
    const r = data as { status: string; attempts_left?: number; claim?: string }
    switch (r.status) {
      case 'verified': return { done: afterConfirmed(r.claim, safeNext(form.get('next'))) }
      case 'wrong': return { error: r.attempts_left ? `That code is not right. You have ${r.attempts_left} ${r.attempts_left === 1 ? 'try' : 'tries'} left.` : 'That code is not right. Ask for a new one.' }
      case 'locked': return { error: 'Too many wrong tries. Ask for a new code.' }
      default: return { error: 'That code has run out. Ask for a new one.' }
    }
  } catch (e) {
    if (e instanceof ActionDenied) return { error: 'Log in again to continue.' }
    throw e
  }
}

export async function resendCode(_prev: ConfirmState, _form: FormData): Promise<ConfirmState> {
  try {
    const a = await requireMemberAction()
    const r = await sendEmailCode({ memberId: a.memberId, tenantId: a.bundle.tenant.id, planeId: a.bundle.tenant.planeId })
    switch (r.status) {
      case 'sent': return { resent: true, retryIn: 60 }
      case 'too_soon': return { retryIn: r.retryIn }
      case 'too_many': return { error: 'You have asked for several codes. Wait an hour, or message us on WhatsApp.', help: true }
      case 'already_verified': return { done: '/dashboard' }
      default: return { error: 'We could not send the email. Message us on WhatsApp and we will help.', help: true }
    }
  } catch (e) {
    if (e instanceof ActionDenied) return { error: 'Log in again to continue.' }
    throw e
  }
}

/**
 * Where a learner goes once the email is confirmed (plan/16 §12): on the learner list -> the dashboard, which offers
 * "Join my batch now"; anyone else -> where they were heading, or the dashboard.
 */
function afterConfirmed(claim: string | undefined, next: string) {
  return claim === 'listed' || next === '/' ? '/dashboard' : next
}
