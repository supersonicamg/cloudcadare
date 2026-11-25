import 'server-only'
import { getPlane } from '@educore/auth'
import { createPrivilegedDb } from '@educore/auth/privileged'
import { FAKE_KEYS, fakeGateway, razorpay, type PaymentGateway } from '@educore/integrations/payments'

// The academy's own payment account. Keys sit in Supabase Vault and are read here, on the server, per call.
// The browser only ever gets the public key id.

export interface TenantGateway {
  gateway: PaymentGateway
  /** Razorpay key id (public). */
  keyId: string
  mode: 'test' | 'live' | 'fake'
}

/** The fake gateway signs with fixed, public keys. It exists for local development and tests only. */
export const fakeGatewayEnabled = () => process.env.EDUCORE_FAKE_GATEWAY === '1' && process.env.NODE_ENV !== 'production'

export async function loadGateway(tenantId: string): Promise<TenantGateway | null> {
  if (fakeGatewayEnabled()) return { gateway: fakeGateway(), keyId: FAKE_KEYS.keyId, mode: 'fake' }
  const db = createPrivilegedDb(getPlane(null))
  const { data, error } = await db.rpc('read_gateway_account', { p_tenant_id: tenantId })
  if (error) throw new Error(`gateway read failed: ${error.message}`)
  const acc = data?.[0]
  if (!acc || acc.gateway !== 'razorpay' || !acc.public_key || !acc.secret) return null
  return {
    gateway: razorpay({ keyId: acc.public_key, secret: acc.secret, webhookSecret: acc.webhook_secret }),
    keyId: acc.public_key,
    mode: acc.mode === 'live' ? 'live' : 'test',
  }
}

/** Called by the admin action AFTER it checked `integration.manage` and the MFA step. */
export async function saveGatewayAccount(i: {
  tenantId: string; mode: 'test' | 'live'; keyId: string; secret: string; webhookSecret: string
}): Promise<void> {
  const db = createPrivilegedDb(getPlane(null))
  const { error } = await db.rpc('save_gateway_account', {
    p_tenant_id: i.tenantId, p_gateway: 'razorpay', p_mode: i.mode, p_public_key: i.keyId, p_secret: i.secret, p_webhook_secret: i.webhookSecret,
  })
  if (error) throw new Error(`gateway save failed: ${error.message}`)
}
