'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireMemberAction } from '@/lib/dal'

/**
 * "I have paid" (plan/16 §5.1). The database makes one payment row and one open proof; pressing the button twice, or
 * in two tabs, gives the same proof. Nothing is unlocked here: staff check the money first.
 */
export async function submitUpiPayment(orderId: string, _form: FormData): Promise<void> {
  if (!z.uuid().safeParse(orderId).success) redirect('/courses')
  const a = await requireMemberAction().catch(() => null)
  if (!a) redirect(`/login?next=${encodeURIComponent(`/checkout/${orderId}`)}`)
  const { error } = await a.db.rpc('submit_upi_payment', { p_order_id: orderId })
  if (error) {
    if (error.message.includes('email_not_confirmed')) redirect(`/signup/confirm?next=${encodeURIComponent(`/checkout/${orderId}`)}`)
    // not payable any more, UPI switched off, nothing due: the checkout page shows what is true now
    redirect(`/checkout/${orderId}`)
  }
  redirect(`/checkout/${orderId}/pending`)
}
