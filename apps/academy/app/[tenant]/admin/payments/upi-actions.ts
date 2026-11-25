'use server'

import { revalidatePath } from 'next/cache'
import { upiFormSchema } from '@educore/core/commerce/upi'
import { ActionDenied, MfaRequired, requireActionAccess } from '@/lib/dal'
import type { KeepState } from '@/lib/use-keep-form'

/** UPI QR settings (plan/16 §3.4). The database function needs price.manage and the two-step check, and audits the change. */
export async function saveUpi(_s: KeepState, form: FormData): Promise<KeepState> {
  const parsed = upiFormSchema.safeParse({
    enabled: form.get('enabled') === 'on',
    vpa: String(form.get('vpa') ?? ''),
    payee_name: String(form.get('payee_name') ?? ''),
    whatsapp_number: String(form.get('whatsapp_number') ?? ''),
    hours_text: String(form.get('hours_text') ?? ''),
    sla_text: String(form.get('sla_text') ?? ''),
    alert_email: String(form.get('alert_email') ?? ''),
    razorpay_coming_soon: form.get('razorpay_coming_soon') === 'on',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' }
  try {
    const a = await requireActionAccess({ permission: 'price.manage', feature: 'commerce.checkout' })
    const { error } = await a.db.rpc('save_upi_settings', { p_tenant_id: a.bundle.tenant.id, p_settings: parsed.data })
    if (error) {
      if (error.message.includes('mfa_required')) throw new MfaRequired()
      if (error.message.includes('not_allowed')) throw new ActionDenied()
      return { error: error.message.includes('invalid_vpa') ? 'A UPI ID looks like name@bank.' : 'Could not save. Try again.' }
    }
    revalidatePath('/admin/payments')
    return { saved: true, message: 'Saved. Learners see the new details at their next checkout.' }
  } catch (e) {
    if (e instanceof MfaRequired) return { error: 'This needs the two-step check first. Open Security, verify your code, then try again.' }
    if (e instanceof ActionDenied) return { error: 'You do not have permission to do that.' }
    return { error: 'Could not save. Try again.' }
  }
}
