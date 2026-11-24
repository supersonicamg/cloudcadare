import { headers } from 'next/headers'
import { fakeGatewayEnabled } from '@educore/core/commerce'
import { requireAccess } from '@/lib/dal'
import { GatewayForm } from './form'
import { pageTitle, sectionTitle } from '@/lib/ui'

export const metadata = { title: 'Payments' }

export default async function Payments() {
  const a = await requireAccess({ permission: 'price.manage', feature: 'commerce.checkout' }, '/admin/payments')
  const { data: acc } = await a.db.from('payment_gateway_accounts')
    .select('mode, public_key, secret_vault_id, webhook_secret_vault_id')
    .eq('is_active', true).eq('is_default', true).maybeSingle()
  const host = (await headers()).get('host') ?? ''
  const proto = host.startsWith('localhost') || host.includes('.localhost') ? 'http' : 'https'
  const hook = `${proto}://${host}/api/webhooks/razorpay/${a.bundle.tenant.id}`

  return (
    <>
      <h1 className={pageTitle}>Payments</h1>
      <p className="mt-2 max-w-2xl text-grey">
        Learners pay into your own Razorpay account, not ours. Add its keys here. Start in test mode and switch to live once a test payment works.
      </p>
      {fakeGatewayEnabled() && (
        <p className="mt-6 max-w-2xl rounded-[var(--radius)] bg-muted px-4 py-3 text-sm">
          A built-in test gateway is switched on for this development server, so checkout works without real keys. It is never available in production.
        </p>
      )}

      <section className="mt-10">
        <h2 className={sectionTitle + " mb-4"}>Razorpay account</h2>
        <GatewayForm mode={(acc?.mode as 'test' | 'live') ?? 'test'} keyId={acc?.public_key ?? ''} hasSecret={Boolean(acc?.secret_vault_id)} hasWebhookSecret={Boolean(acc?.webhook_secret_vault_id)} />
      </section>

      <section className="mt-14 max-w-2xl">
        <h2 className="mb-3 text-xl font-semibold">Webhook</h2>
        <p className="text-[15px] text-fg/80">
          In the Razorpay dashboard add a webhook with this address, choose the <b>payment.captured</b> and <b>order.paid</b> events, and use the same secret as above.
          Webhooks confirm payments even when a learner closes the page before it returns to your site.
        </p>
        <p className="mt-3 break-all rounded bg-muted px-3 py-2 text-sm" data-testid="webhook-url">{hook}</p>
      </section>
    </>
  )
}
