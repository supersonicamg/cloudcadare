import { headers } from 'next/headers'
import { fakeGatewayEnabled } from '@educore/core/commerce'
import { readUpiSettings } from '@educore/core/commerce/upi'
import { requireAccess } from '@/lib/dal'
import { Card, PageHeader, Tabs } from '../_components/ui'
import { paymentPages, waitingPayments } from '../_components/sections'
import { GatewayForm } from './form'
import { UpiForm } from './upi-form'

export const metadata = { title: 'How learners pay' }

/*
 * D3 · Payment settings.
 * 1. One job: set how learners pay. 2. One main action: "Save settings" (UPI form; the Razorpay form below is a second,
 *    separate save). 3. Reading order: title -> UPI panel (dominant, it is the live method) -> Razorpay keys and webhook
 *    (quiet, below the fold, "coming soon" to learners until keys are saved).
 */
export default async function Payments() {
  const a = await requireAccess({ permission: 'price.manage', feature: 'commerce.checkout' }, '/admin/payments')
  const [{ data: acc }, { data: settings }] = await Promise.all([
    a.db.from('payment_gateway_accounts').select('mode, public_key, secret_vault_id, webhook_secret_vault_id').eq('is_active', true).eq('is_default', true).maybeSingle(),
    a.db.from('tenant_settings').select('commerce').eq('tenant_id', a.bundle.tenant.id).maybeSingle(),
  ])
  const upi = readUpiSettings((settings?.commerce as { upi?: unknown } | null)?.upi)
  const host = (await headers()).get('host') ?? ''
  const proto = host.startsWith('localhost') || host.includes('.localhost') ? 'http' : 'https'
  const hook = `${proto}://${host}/api/webhooks/razorpay/${a.bundle.tenant.id}`

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div>
        <PageHeader title="Payments" lead="Choose how students pay you. UPI works now; cards and net banking need a Razorpay account." />
        <Tabs label="Payments" current="/admin/payments" items={paymentPages(a, await waitingPayments(a))} />
      </div>

      <Card title="UPI QR" lead="Students scan a code, pay, and you approve it."><UpiForm s={upi} /></Card>

      <Card title="Cards and net banking (Razorpay)" lead="Money goes into your own Razorpay account. Start in test mode and switch to live once a test payment works.">
        <div className="grid max-w-2xl gap-4">
        {fakeGatewayEnabled() && (
          <p className="t-label rounded-2xl bg-muted px-4 py-3 !text-fg">A built-in test gateway is on for this development server, so checkout works without real keys. It is never available in production.</p>
        )}
        <GatewayForm mode={(acc?.mode as 'test' | 'live') ?? 'test'} keyId={acc?.public_key ?? ''} hasSecret={Boolean(acc?.secret_vault_id)} hasWebhookSecret={Boolean(acc?.webhook_secret_vault_id)} />
        <div className="grid gap-2 border-t-2 border-fg pt-4">
          <h3 className="t-card">Webhook</h3>
          <p className="t-body">In the Razorpay dashboard add a webhook with this address, choose the <b>payment.captured</b> and <b>order.paid</b> events, and use the same secret as above. Webhooks confirm payments even when a learner closes the page too early.</p>
          <p className="t-label break-all rounded-xl bg-muted px-3 py-2 !text-fg" data-testid="webhook-url">{hook}</p>
        </div>
        </div>
      </Card>
    </div>
  )
}
