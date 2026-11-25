'use server'

import { redirect } from 'next/navigation'
import { ActionDenied, requireMemberAction } from '@/lib/dal'
import { kickOutbox } from '@/lib/outbox'

/**
 * "Join my batch now" (plan/16 §12). The database matches only the caller's own confirmed email against the learner
 * list, creates one enrolment, and does nothing on a second press.
 */
export async function joinListedBatch(_form: FormData): Promise<void> {
  let target = '/dashboard?joined=0'
  try {
    const a = await requireMemberAction()
    const { data, error } = await a.db.rpc('claim_my_list_access', { p_tenant_id: a.bundle.tenant.id })
    if (error) console.error('claim_my_list_access failed:', error.message)
    else if (data === 'claimed' || data === 'already_enrolled') target = '/dashboard?joined=1'
    kickOutbox()
  } catch (e) {
    if (!(e instanceof ActionDenied)) throw e
    target = '/login?next=%2Fdashboard'
  }
  redirect(target)
}
