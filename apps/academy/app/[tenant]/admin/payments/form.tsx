'use client'

import { useKeepForm } from '@/lib/use-keep-form'
import { button, hint, input, label } from '@/lib/ui'
import { saveGateway } from './actions'

export function GatewayForm({ mode, keyId, hasSecret, hasWebhookSecret }: { mode: 'test' | 'live'; keyId: string; hasSecret: boolean; hasWebhookSecret: boolean }) {
  const [s, onSubmit, pending] = useKeepForm(saveGateway.bind(null, hasSecret))
  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-5" autoComplete="off">
      <div>
        <label htmlFor="mode" className={label}>Mode</label>
        <select id="mode" name="mode" defaultValue={mode} className={input}>
          <option value="test">Test (no real money)</option>
          <option value="live">Live</option>
        </select>
      </div>
      <div>
        <label htmlFor="key_id" className={label}>Key ID</label>
        <input id="key_id" name="key_id" defaultValue={keyId} placeholder="rzp_test_…" required className={input} />
      </div>
      <div>
        <label htmlFor="secret" className={label}>Key Secret</label>
        <input id="secret" name="secret" type="password" autoComplete="new-password" placeholder={hasSecret ? 'Saved. Leave blank to keep it.' : ''} className={input} />
      </div>
      <div>
        <label htmlFor="webhook_secret" className={label}>Webhook secret</label>
        <input id="webhook_secret" name="webhook_secret" type="password" autoComplete="new-password" placeholder={hasWebhookSecret ? 'Saved. Leave blank to keep it.' : ''} className={input} />
        <p className={hint}>The secret you set when you add the webhook in Razorpay (see below).</p>
      </div>
      {s.error && <p role="alert" className="text-sm text-danger">{s.error}</p>}
      {s.saved && <p className="text-sm text-success">{s.message}</p>}
      <div><button className={button} disabled={pending}>{pending ? 'Saving…' : 'Save payment account'}</button></div>
    </form>
  )
}
