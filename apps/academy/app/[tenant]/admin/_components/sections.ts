import { isEnabled } from '@educore/features'
import { can, holds, type Access } from '@/lib/dal'

// The admin is five plain places. A place with more than one page shows them as tabs; each person sees only what
// they may open (the page itself checks again).

export interface Page { href: string; label: string; badge?: number }
const only = (list: (Page & { show: boolean })[]): Page[] => list.filter((p) => p.show).map(({ show: _, ...p }) => p)

export const canTeach = (a: Access) => isEnabled(a.bundle.features, 'catalog.courses') && (can(a, 'course.manage') || can(a, 'course.view_all'))

export function studentPages(a: Access): Page[] {
  const show = isEnabled(a.bundle.features, 'catalog.courses') && holds(a, 'enrollment.manage')
  return only([
    { href: '/admin/enrolments', label: 'Students with access', show },
    { href: '/admin/learner-list', label: 'Approve emails in advance', show },
  ])
}

/** Payments waiting to be checked. Row-level security limits the count to people who may see proofs. */
export async function waitingPayments(a: Access): Promise<number> {
  if (!isEnabled(a.bundle.features, 'commerce.checkout') || !(holds(a, 'payment.verify') || can(a, 'order.view'))) return 0
  return (await a.db.from('payment_proofs').select('id', { count: 'exact', head: true }).eq('state', 'pending_review')).count ?? 0
}

export function paymentPages(a: Access, waiting = 0): Page[] {
  const sells = isEnabled(a.bundle.features, 'commerce.checkout')
  return only([
    { href: '/admin/payments/upi', label: 'Payments to check', badge: waiting || undefined, show: sells && (holds(a, 'payment.verify') || can(a, 'order.view')) },
    { href: '/admin/orders', label: 'All orders', show: sells && can(a, 'order.view') },
    { href: '/admin/coupons', label: 'Discount codes', show: isEnabled(a.bundle.features, 'commerce.coupons') && can(a, 'coupon.manage') },
    { href: '/admin/payments', label: 'How learners pay', show: sells && holds(a, 'price.manage') },
  ])
}
