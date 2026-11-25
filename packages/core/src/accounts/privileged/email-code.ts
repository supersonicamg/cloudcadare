import 'server-only'
import { getPlane } from '@educore/auth'
import { createPrivilegedDb } from '@educore/auth/privileged'
import { emailSenderFromEnv } from '@educore/integrations/email'
import { safeDisplayName } from '../../notifications/render'

// Sends the 6-digit code that proves a new learner owns their email (plan/16 §4.1). The code is created inside
// the database by a service-role-only function and never reaches the browser: it goes by email, and the learner
// types it back into verify_email_code.

export type SendCodeResult =
  | { status: 'sent'; email: string }
  | { status: 'too_soon'; retryIn: number }
  | { status: 'too_many' }
  | { status: 'already_verified' }
  | { status: 'not_configured' }

export async function sendEmailCode(opts: { memberId: string; tenantId: string; planeId?: string | null }): Promise<SendCodeResult> {
  const d = createPrivilegedDb(getPlane(opts.planeId ?? null))
  const { data, error } = await d.rpc('issue_email_code', { p_member_id: opts.memberId })
  if (error) throw new Error(`issue_email_code failed: ${error.message}`)
  const r = data as { status: string; code?: string; email?: string; name?: string; retry_in?: number }
  if (r.status === 'too_soon') return { status: 'too_soon', retryIn: r.retry_in ?? 60 }
  if (r.status === 'too_many') return { status: 'too_many' }
  if (r.status === 'already_verified') return { status: 'already_verified' }
  if (r.status !== 'issued' || !r.code || !r.email) throw new Error('issue_email_code returned an unexpected answer')

  const { data: brand } = await d.from('tenant_branding').select('display_name').eq('tenant_id', opts.tenantId).maybeSingle()
  const name = safeDisplayName(brand?.display_name ?? 'Your academy')
  const address = process.env.EMAIL_FROM_ADDRESS || `noreply@${process.env.BASE_DOMAIN ?? 'localhost'}`
  const message = {
    from: `${name} <${address}>`,
    to: r.email,
    subject: `${r.code} is your ${name} code`,
    text: `Hi ${(r.name ?? '').split(' ')[0] || 'there'},\n\nYour ${name} code is ${r.code}.\n\nIt works for 10 minutes. If you did not create an account, ignore this email.`,
  }

  const sender = emailSenderFromEnv()
  try {
    if (!sender) throw new Error('email_not_configured')
    await sender.send(message)
    return { status: 'sent', email: r.email }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      // Development only: no mail server is reachable, so print the code where the developer can read it.
      console.info(`[dev] email code for ${r.email}: ${r.code} (${e instanceof Error ? e.message : String(e)})`)
      return { status: 'sent', email: r.email }
    }
    console.error('email code could not be sent:', e instanceof Error ? e.message : e)
    return { status: 'not_configured' }
  }
}
