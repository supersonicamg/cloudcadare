'use client'

import { useActionState } from 'react'
import { buttonQuiet, inputLg } from '@/lib/ui'
import { applyCoupon, removeCoupon, type CouponState } from './actions'

export function CouponForm({ orderId, applied }: { orderId: string; applied: boolean }) {
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
  return (
    <details className="group" open={Boolean(s.error) || undefined}>
      <summary className="cursor-pointer list-none text-base font-semibold text-primary [&::-webkit-details-marker]:hidden">Have a coupon?</summary>
      <form action={action} className="mt-3 grid gap-2">
        <label htmlFor="code" className="text-[15px] font-semibold">Have a coupon code?</label>
        <div className="flex gap-2.5">
          <input id="code" name="code" autoComplete="off" className={`${inputLg} uppercase`} />
          <button className={`${buttonQuiet} h-14 px-5`} disabled={pending}>{pending ? 'Checking…' : 'Apply'}</button>
        </div>
        {s.error && <p role="alert" className="text-[15px] font-semibold text-danger">{s.error}</p>}
      </form>
    </details>
  )
}
