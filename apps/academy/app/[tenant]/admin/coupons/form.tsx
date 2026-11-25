'use client'

import { useActionState } from 'react'
import { buttonSm, inputSm } from '@/lib/ui'
import { Field } from '../_components/ui'
import { createCoupon, type CouponFormState } from './actions'

export function CouponCreateForm() {
  const [s, action, pending] = useActionState<CouponFormState, FormData>(createCoupon, {})
  return (
    <form action={action} className="grid max-w-2xl gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="code" label="Code" hint="What students type."><input id="code" name="code" required autoComplete="off" placeholder="DIWALI20" className={`${inputSm} uppercase`} /></Field>
        <Field id="type" label="Kind of discount"><select id="type" name="type" className={inputSm}><option value="percent">Percent off</option><option value="fixed">Rupees off</option></select></Field>
        <Field id="value" label="How much" hint="A percentage, or rupees."><input id="value" name="value" inputMode="decimal" required className={inputSm} /></Field>
      </div>
      <details className="rounded-2xl ring-1 ring-border">
        <summary className="min-h-12 cursor-pointer content-center px-4 t-label !text-fg">Limits (optional)</summary>
        <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
          <Field id="ends_on" label="Last day it works"><input id="ends_on" name="ends_on" type="date" className={inputSm} /></Field>
          <Field id="max_redemptions" label="Total uses" hint="Empty means no limit."><input id="max_redemptions" name="max_redemptions" inputMode="numeric" className={inputSm} /></Field>
          <Field id="per_member" label="Uses per student"><input id="per_member" name="per_member" inputMode="numeric" defaultValue="1" className={inputSm} /></Field>
          <Field id="max_discount" label="Biggest discount (₹)" hint="For percent codes."><input id="max_discount" name="max_discount" inputMode="decimal" className={inputSm} /></Field>
          <Field id="min_order" label="Smallest price it works on (₹)"><input id="min_order" name="min_order" inputMode="decimal" className={inputSm} /></Field>
        </div>
      </details>
      {s.error && <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 t-label !text-danger-ink">{s.error}</p>}
      {s.saved && <p role="status" className="rounded-xl bg-ok-bg px-4 py-3 t-label !text-ok-ink">Coupon created.</p>}
      <div><button className={buttonSm} disabled={pending}>{pending ? 'Creating…' : 'Create coupon'}</button></div>
    </form>
  )
}
