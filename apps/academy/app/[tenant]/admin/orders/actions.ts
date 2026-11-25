'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { refundOrder } from '@educore/core/commerce'
import { ActionDenied, MfaRequired, requireActionAccess } from '@/lib/dal'
import { kickOutbox } from '@/lib/outbox'

export type RefundState = { error?: string; saved?: boolean }

/** Needs refund.manage, which asks for the authenticator code (sensitive). The amount is read from our own records. */
export async function refund(orderId: string, _s: RefundState, form: FormData): Promise<RefundState> {
  if (!z.uuid().safeParse(orderId).success) return { error: 'This order was not found.' }
  const raw = String(form.get('amount') ?? '').replace(/[,\s₹]/g, '')
  const typed = raw ? Math.round(Number(raw) * 100) : null
  if (typed !== null && (!Number.isFinite(typed) || typed <= 0)) return { error: 'Enter an amount in rupees, or leave it blank to refund everything that is left.' }
  const reason = z.string().trim().max(300).safeParse(form.get('reason') ?? '')
  if (!reason.success) return { error: 'The reason is too long.' }

  try {
    const a = await requireActionAccess({ permission: 'refund.manage', feature: 'commerce.checkout' })
    const { data: pay } = await a.db.from('payments').select('id, amount_minor').eq('order_id', orderId).in('status', ['captured', 'partially_refunded']).limit(1).maybeSingle()
    if (!pay) return { error: 'This order has no payment that can be refunded.' }
    const { data: prior } = await a.db.from('refunds').select('amount_minor').eq('payment_id', pay.id).in('status', ['pending', 'processed'])
    const left = pay.amount_minor - (prior ?? []).reduce((n, r) => n + r.amount_minor, 0)
    const amount = typed ?? left
    if (amount <= 0 || amount > left) return { error: `You can refund at most ${(left / 100).toLocaleString('en-IN')} rupees on this order.` }

    const r = await refundOrder({
      tenantId: a.bundle.tenant.id, orderId, amountMinor: amount, reason: reason.data || null,
      revokeAccess: form.get('revoke') === 'on', staffMemberId: a.memberId,
    })
    if (!r.ok) {
      return { error: ({
        not_refundable: 'This order cannot be refunded.',
        amount_invalid: 'That amount is more than is left to refund.',
        gateway_not_configured: 'Payments are not set up, so a refund cannot be sent.',
        gateway_failed: 'The payment gateway did not accept the refund. Nothing was changed. Try again, or refund from the gateway dashboard.',
      } as const)[r.reason] }
    }
    kickOutbox()
    revalidatePath(`/admin/orders/${orderId}`)
    revalidatePath('/admin/orders')
    return { saved: true }
  } catch (e) {
    if (e instanceof MfaRequired) return { error: 'This needs the two-step check first. Open Security, verify your code, then try again.' }
    if (e instanceof ActionDenied) return { error: 'You do not have permission to do that.' }
    throw e
  }
}
