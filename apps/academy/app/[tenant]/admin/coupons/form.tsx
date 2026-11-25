'use client'

import { useActionState } from 'react'
import { button, hint, input, label } from '@/lib/ui'
import { createCoupon, type CouponFormState } from './actions'

export function CouponCreateForm() {
  const [s, action, pending] = useActionState<CouponFormState, FormData>(createCoupon, {})
  return (
    <form action={action} className="grid max-w-2xl gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label htmlFor="code" className={label}>Code</label><input id="code" name="code" required autoComplete="off" className={`${input} uppercase`} /></div>
        <div><label htmlFor="type" className={label}>Type</label>
          <select id="type" name="type" className={input}><option value="percent">Percent off</option><option value="fixed">Fixed amount off</option></select></div>
        <div><label htmlFor="value" className={label}>Discount</label><input id="value" name="value" inputMode="decimal" required className={input} />
          <p className={hint}>A percentage, or rupees.</p></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label htmlFor="max_discount" className={label}>Cap (₹)</label><input id="max_discount" name="max_discount" inputMode="decimal" className={input} /><p className={hint}>Percent coupons only. Optional.</p></div>
        <div><label htmlFor="min_order" className={label}>Minimum price (₹)</label><input id="min_order" name="min_order" inputMode="decimal" className={input} /><p className={hint}>Optional.</p></div>
        <div><label htmlFor="ends_on" className={label}>Last day</label><input id="ends_on" name="ends_on" type="date" className={input} /><p className={hint}>Optional.</p></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label htmlFor="max_redemptions" className={label}>Total uses</label><input id="max_redemptions" name="max_redemptions" inputMode="numeric" className={input} /><p className={hint}>Blank means unlimited.</p></div>
        <div><label htmlFor="per_member" className={label}>Uses per learner</label><input id="per_member" name="per_member" inputMode="numeric" defaultValue="1" className={input} /></div>
      </div>
      {s.error && <p role="alert" className="text-sm text-danger">{s.error}</p>}
      {s.saved && <p className="text-sm text-success">Coupon created.</p>}
      <div><button className={button} disabled={pending}>{pending ? 'Creating…' : 'Create coupon'}</button></div>
    </form>
  )
}
