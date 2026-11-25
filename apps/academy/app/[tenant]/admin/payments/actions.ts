'use server'

import { z } from 'zod'
import { saveGatewayAccount } from '@educore/core/commerce'
import { ActionDenied, MfaRequired, requireActionAccess } from '@/lib/dal'
import type { KeepState } from '@/lib/use-keep-form'

// The academy's own Razorpay account. The secret goes straight to Vault through a service-only function;
// it is never returned to the browser, not even to the person who typed it.

const schema = z.object({
  mode: z.enum(['test', 'live']),
  keyId: z.string().trim().regex(/^rzp_(test|live)_[A-Za-z0-9]{6,40}$/, 'The Key ID looks like rzp_test_… or rzp_live_…'),
  secret: z.string().trim().max(200),
  webhookSecret: z.string().trim().max(200),
})

export async function saveGateway(hasSecret: boolean, _s: KeepState, form: FormData): Promise<KeepState> {
  const parsed = schema.safeParse({ mode: form.get('mode'), keyId: form.get('key_id'), secret: form.get('secret') ?? '', webhookSecret: form.get('webhook_secret') ?? '' })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' }
  const { mode, keyId, secret, webhookSecret } = parsed.data
  if (!keyId.startsWith(`rzp_${mode}_`)) return { error: `A ${mode} account uses a Key ID that starts with rzp_${mode}_.` }
  if (!hasSecret && !secret) return { error: 'Enter the Key Secret.' }
  if (secret && secret.length < 8) return { error: 'That Key Secret looks too short.' }
  try {
    const a = await requireActionAccess({ permission: 'price.manage', feature: 'commerce.checkout' })
    await saveGatewayAccount({ tenantId: a.bundle.tenant.id, mode, keyId, secret, webhookSecret })
    return { saved: true, message: 'Saved. The secrets are stored encrypted and will not be shown again.' }
  } catch (e) {
    if (e instanceof MfaRequired) return { error: 'This needs the two-step check first. Open Security, verify your code, then try again.' }
    if (e instanceof ActionDenied) return { error: 'You do not have permission to do that.' }
    return { error: 'Could not save. Try again.' }
  }
}
