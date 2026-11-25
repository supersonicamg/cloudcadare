'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { buttonLg } from '@/lib/ui'

interface RazorpayResponse { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }
declare global {
  interface Window { Razorpay?: new (o: Record<string, unknown>) => { open(): void } }
}

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Could not load the payment window.'))
    document.head.appendChild(s)
  })
}

export function PayButton(p: {
  orderId: string; gatewayOrderId: string; keyId: string; amountMinor: number; currency: string; amountLabel: string
  academy: string; description: string; prefill: { name: string; email: string }
  /** Only on the local fake gateway: a ready-made "payment" so no real checkout window is needed. */
  fake?: { paymentId: string; signature: string }
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm(r: RazorpayResponse) {
    setBusy(true)
    const res = await fetch('/api/checkout/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: p.orderId, ...r }) })
    if (res.ok) { router.push('/dashboard?paid=1'); router.refresh(); return }
    setBusy(false)
    setError('We could not confirm the payment. If money left your account, it will be matched automatically within a few minutes. Check your dashboard, or contact the academy.')
  }

  async function pay() {
    setError(null)
    if (p.fake) return confirm({ razorpay_order_id: p.gatewayOrderId, razorpay_payment_id: p.fake.paymentId, razorpay_signature: p.fake.signature })
    try {
      setBusy(true)
      await loadCheckout()
      new window.Razorpay!({
        key: p.keyId, amount: p.amountMinor, currency: p.currency, name: p.academy, description: p.description, order_id: p.gatewayOrderId,
        prefill: p.prefill, handler: confirm, modal: { ondismiss: () => setBusy(false) },
      }).open()
    } catch (e) {
      setBusy(false)
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    }
  }

  return (
    <div data-gateway-order={p.gatewayOrderId}>
      <button className={`${buttonLg} w-full`} onClick={pay} disabled={busy}>{busy ? 'Processing…' : `Pay ${p.amountLabel}`}</button>
      {p.fake && <p className="mt-3 text-sm text-mute">Test gateway: no real money moves.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  )
}
