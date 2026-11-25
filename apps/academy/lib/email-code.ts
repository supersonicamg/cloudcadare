import 'server-only'
import type { Access } from '@/lib/dal'

/**
 * Whether this academy asks new learners for the 6-digit email code (plan/16 §4.1). An academy without a mail server
 * can switch it off while testing (migration 36). Any error means "required": the safe answer.
 * The learner list ignores this switch: it only ever matches a proven address.
 */
export async function emailCodeRequired(db: Access['db'], tenantId: string): Promise<boolean> {
  const { data, error } = await db.rpc('email_code_required', { p_tenant_id: tenantId })
  if (error) console.error('email_code_required failed:', error.message)
  return data !== false
}
