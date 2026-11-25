import 'server-only'
import type { Access } from '@/lib/dal'

/**
 * An academy whose payment details are not real yet can switch online payment off: checkout then shows no UPI ID, QR
 * or card button, and a learner joins only with a coupon code. Per academy, in tenant_settings.commerce:
 *   off: update public.tenant_settings set commerce = commerce || '{"online_payments":"off"}' where tenant_id = '…';
 *   on:  update public.tenant_settings set commerce = commerce - 'online_payments' where tenant_id = '…';
 */
export const paymentsOff = (commerce: unknown) => (commerce as { online_payments?: unknown } | null | undefined)?.online_payments === 'off'

/** For actions that have not read the settings. If they cannot be read, no payment is started. */
export async function onlinePaymentsOff(db: Access['db'], tenantId: string): Promise<boolean> {
  const { data, error } = await db.from('tenant_settings').select('commerce').eq('tenant_id', tenantId).maybeSingle()
  if (error) console.error('reading the payment switch failed:', error.message)
  return Boolean(error) || paymentsOff(data?.commerce)
}
