'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { completeFreeOrder, startGatewayPayment } from '@educore/core/commerce'
import { isEnabled } from '@educore/features'
import { ActionDenied, requireMemberAction } from '@/lib/dal'
import { kickOutbox } from '@/lib/outbox'

/** "Buy" on a course page. The order is created by the database from the product's current price. */
export async function startCheckout(productId: string, priceId: string, slug: string, _form: FormData): Promise<void> {
  let target: string
  try {
    const a = await requireMemberAction()
    const { data, error } = await a.db.rpc('create_order', { p_product_id: productId, p_price_id: priceId })
    if (error) {
      // already bought: go learn; anything else: back to the course, whose button reflects what is possible now
      target = error.message.includes('already_enrolled') ? `/learn/${slug}` : `/courses/${slug}`
    } else {
      const orderId = (data as { order_id: string }).order_id
      // A missing gateway is not an error here: the checkout page explains it.
      await startGatewayPayment({ tenantId: a.bundle.tenant.id, orderId })
      target = `/checkout/${orderId}`
    }
  } catch (e) {
    if (!(e instanceof ActionDenied)) throw e
    target = `/login?next=${encodeURIComponent(`/courses/${slug}`)}`
  }
  redirect(target)
}

export type CouponState = { error?: string }

const COUPON_MESSAGES: Record<string, string> = {
  coupon_invalid: 'That code does not work for this order.',
  coupon_expired: 'That code has expired.',
  coupon_used_up: 'That code has already been used up.',
  coupon_min_order: 'This order is below the minimum for that code.',
  order_not_payable: 'This order can no longer be changed.',
}

/** Re-prices the order, then opens a new gateway order for the new total (the old one is closed by the database). */
async function repriced(orderId: string, rpc: (db: Awaited<ReturnType<typeof requireMemberAction>>['db']) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<CouponState> {
  if (!z.uuid().safeParse(orderId).success) return { error: 'This order was not found.' }
  try {
    const a = await requireMemberAction()
    if (!isEnabled(a.bundle.features, 'commerce.coupons')) return { error: 'Coupons are not available.' }
    const { data, error } = await rpc(a.db)
    if (error) return { error: COUPON_MESSAGES[Object.keys(COUPON_MESSAGES).find((k) => error.message.includes(k)) ?? ''] ?? 'Something went wrong. Try again.' }
    if ((data as { total_minor: number }).total_minor > 0) await startGatewayPayment({ tenantId: a.bundle.tenant.id, orderId })
  } catch (e) {
    return { error: e instanceof ActionDenied ? 'Please sign in again.' : 'Something went wrong. Try again.' }
  }
  redirect(`/checkout/${orderId}`)
}

export async function applyCoupon(orderId: string, _s: CouponState, form: FormData): Promise<CouponState> {
  const code = z.string().trim().min(1).max(40).safeParse(form.get('code'))
  if (!code.success) return { error: 'Enter a code.' }
  return repriced(orderId, (db) => db.rpc('apply_coupon', { p_order_id: orderId, p_code: code.data }))
}

export async function removeCoupon(orderId: string, _form: FormData): Promise<void> {
  await repriced(orderId, (db) => db.rpc('remove_coupon', { p_order_id: orderId }))
}

/** The order is 0 after a coupon: nothing to pay, so enrol. The database checks the total really is 0. */
export async function completeFree(orderId: string, _form: FormData): Promise<void> {
  if (!z.uuid().safeParse(orderId).success) redirect('/courses')
  const a = await requireMemberAction().catch(() => null)
  if (!a) redirect(`/login?next=${encodeURIComponent(`/checkout/${orderId}`)}`)
  // ownership: RLS lets a learner read only their own orders
  const { data: order } = await a.db.from('orders').select('id, total_minor, status').eq('id', orderId).maybeSingle()
  if (!order || order.total_minor !== 0 || order.status !== 'awaiting_payment') redirect(`/checkout/${orderId}`)
  await completeFreeOrder({ orderId })
  kickOutbox()
  redirect('/learn')
}
