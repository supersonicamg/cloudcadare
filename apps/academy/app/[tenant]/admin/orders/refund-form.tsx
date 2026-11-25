'use client'

import { useActionState } from 'react'
import { button, hint, input, label } from '@/lib/ui'
import { refund, type RefundState } from './actions'

export function RefundForm({ orderId, left }: { orderId: string; left: string }) {
  const [s, action, pending] = useActionState<RefundState, FormData>(refund.bind(null, orderId), {})
  return (
    <form action={action} className="grid max-w-lg gap-4">
      <div><label htmlFor="amount" className={label}>Amount (₹)</label><input id="amount" name="amount" inputMode="decimal" placeholder={left} className={input} />
        <p className={hint}>Leave blank to refund all that is left ({left}).</p></div>
      <div><label htmlFor="reason" className={label}>Reason</label><input id="reason" name="reason" maxLength={300} className={input} /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="revoke" defaultChecked /> Take away the learner&rsquo;s access to the course</label>
      {s.error && <p role="alert" className="text-sm text-danger">{s.error}</p>}
      {s.saved && <p className="text-sm text-success">Refund sent.</p>}
      <div><button className={button} disabled={pending}>{pending ? 'Refunding…' : 'Refund'}</button></div>
    </form>
  )
}
