import { BadSignature, type GatewayKeys, type PaymentGateway, type WebhookResult } from './port'
import { hmacHex, safeEqualHex } from './signature'

// Razorpay Orders API + Standard Checkout + webhooks.
//   create order : POST https://api.razorpay.com/v1/orders (basic auth key_id:key_secret), amount in paise
//   checkout     : browser returns razorpay_payment_id + razorpay_signature = HMAC_SHA256(order_id|payment_id, key_secret)
//   webhook      : header X-Razorpay-Signature = HMAC_SHA256(raw body, webhook secret); id in X-Razorpay-Event-Id

interface RzpPaymentEntity { id: string; order_id: string | null; amount: number; currency: string; method?: string; status?: string; error_description?: string | null }
interface RzpWebhook { event: string; payload?: { payment?: { entity?: RzpPaymentEntity } } }

export function razorpay(keys: GatewayKeys, fetchImpl: typeof fetch = fetch): PaymentGateway {
  return {
    name: 'razorpay',

    async createOrder({ receipt, amountMinor, currency, notes }) {
      const res = await fetchImpl('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Basic ${Buffer.from(`${keys.keyId}:${keys.secret}`).toString('base64')}` },
        body: JSON.stringify({ amount: amountMinor, currency, receipt: receipt.slice(0, 40), notes }),
      })
      if (!res.ok) throw new Error(`Razorpay order failed (${res.status})`)
      const body = (await res.json()) as { id?: string }
      if (!body.id) throw new Error('Razorpay order failed (no id)')
      return { gatewayOrderId: body.id }
    },

    verifyCheckout({ gatewayOrderId, gatewayPaymentId, signature }) {
      return safeEqualHex(hmacHex(keys.secret, `${gatewayOrderId}|${gatewayPaymentId}`), signature)
    },

    parseWebhook(rawBody, headers): WebhookResult {
      const secret = keys.webhookSecret
      const sig = headers.get('x-razorpay-signature')
      if (!secret || !sig || !safeEqualHex(hmacHex(secret, rawBody), sig)) throw new BadSignature()

      const eventId = headers.get('x-razorpay-event-id') ?? hmacHex('event', rawBody)
      let body: RzpWebhook
      try { body = JSON.parse(rawBody) as RzpWebhook } catch { throw new BadSignature() }
      const p = body.payload?.payment?.entity
      // `payment.captured` is the money-arrived event; `order.paid` also carries the payment entity.
      if ((body.event === 'payment.captured' || body.event === 'order.paid') && p?.order_id) {
        return { kind: 'paid', event: { eventId, gatewayOrderId: p.order_id, gatewayPaymentId: p.id, amountMinor: p.amount, currency: p.currency, method: p.method ?? null } }
      }
      if (body.event === 'payment.failed' && p?.order_id) {
        return { kind: 'failed', eventId, gatewayOrderId: p.order_id, reason: (p.error_description ?? 'The payment did not go through.').slice(0, 200) }
      }
      return { kind: 'ignored', eventId, type: body.event }
    },

    async refund({ gatewayPaymentId, amountMinor, receipt }) {
      const res = await fetchImpl(`https://api.razorpay.com/v1/payments/${encodeURIComponent(gatewayPaymentId)}/refund`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Basic ${Buffer.from(`${keys.keyId}:${keys.secret}`).toString('base64')}` },
        body: JSON.stringify({ amount: amountMinor, speed: 'normal', receipt: receipt.slice(0, 40) }),
      })
      if (!res.ok) throw new Error(`Razorpay refund failed (${res.status})`)
      const body = (await res.json()) as { id?: string }
      if (!body.id) throw new Error('Razorpay refund failed (no id)')
      return { gatewayRefundId: body.id }
    },
  }
}
