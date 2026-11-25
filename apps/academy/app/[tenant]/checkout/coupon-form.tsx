'use client'

import { useActionState } from 'react'
import { buttonLg, buttonQuiet, inputLg } from '@/lib/ui'
import { applyCoupon, removeCoupon, type CouponState } from './actions'

/** `main`: the coupon is the only way to join, so the field is always open and its button is the filled one. */
export function CouponForm({ orderId, applied, main }: { orderId: string; applied: boolean; main?: boolean }) {
  const [s, action, pending] = useActionState<CouponState, FormData>(applyCoupon.bind(null, orderId), {})
  if (applied) {
    return (
      <form action={removeCoupon.bind(null, orderId)} className="grid gap-2">
        <span className="text-[15px] font-semibold">Coupon</span>
        <div className="flex gap-2.5">
          <p className={`${inputLg} flex items-center`}>Coupon applied</p>
          <button className={`${buttonQuiet} h-14 px-5`}>Remove</button>
        </div>
      </form>
    )
  }
  const form = (
    <form action={action} className="grid gap-2">
      <label htmlFor="code" className="text-[15px] font-semibold">{main ? 'Coupon code' : 'Have a coupon code?'}</label>
      <div className="flex flex-wrap gap-2.5">
        <input id="code" name="code" autoComplete="off" required={main} className={`${inputLg} min-w-0 flex-1 basis-56 uppercase`} />
        <button className={main ? `${buttonLg} w-full sm:w-auto` : `${buttonQuiet} h-14 px-5`} disabled={pending}>{pending ? 'Checking…' : main ? 'Apply code' : 'Apply'}</button>
      </div>
      {s.error && <p role="alert" className="text-[15px] font-semibold text-danger">{s.error}</p>}
    </form>
  )
  if (main) return form
  return (
    <details className="group" open={Boolean(s.error) || undefined}>
      <summary className="cursor-pointer list-none text-base font-semibold text-primary [&::-webkit-details-marker]:hidden">Have a coupon?</summary>
      <div className="mt-3">{form}</div>
    </details>
  )
}
