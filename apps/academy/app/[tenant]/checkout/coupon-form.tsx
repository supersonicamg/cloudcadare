'use client'

import { useActionState } from 'react'
import { Ic } from '../_components/v11'
import { applyCoupon, removeCoupon, type CouponState } from './actions'

/** `main`: the coupon is the only way to join, so the field is always open and its button is the filled one. */
export function CouponForm({ orderId, applied, main }: { orderId: string; applied: boolean; main?: boolean }) {
  const [s, action, pending] = useActionState<CouponState, FormData>(applyCoupon.bind(null, orderId), {})
  if (applied) {
    return (
      <form action={removeCoupon.bind(null, orderId)} className="coup-on">
        <span className="ok-line"><Ic n="check" s />Coupon applied</span>
        <button className="link link-s">Remove</button>
      </form>
    )
  }
  const error = s.error && <p role="alert" className="ferr"><Ic n="info" s />{s.error}</p>
  if (main) {
    return (
      <form action={action} className="fld">
        <label htmlFor="code">Coupon code</label>
        <div className="coup coup-big">
          <input id="code" name="code" className="in" autoComplete="off" required placeholder="Type your code" />
          <button className="btn" disabled={pending}>{pending ? 'Checking…' : 'Apply code'}</button>
        </div>
        <p className="hint">A code that covers the full price gives you “Enrol for free”.</p>
        {error}
      </form>
    )
  }
  return (
    <details className="cpn" open={Boolean(s.error) || undefined}>
      <summary className="link link-s">Have a coupon code?</summary>
      <form action={action} className="fld">
        <div className="coup">
          <label className="sr" htmlFor="code">Coupon code</label>
          <input id="code" name="code" className="in" autoComplete="off" placeholder="Code" />
          <button className="btn btn-line btn-sm" disabled={pending}>{pending ? 'Checking…' : 'Apply'}</button>
        </div>
        {error}
      </form>
    </details>
  )
}
