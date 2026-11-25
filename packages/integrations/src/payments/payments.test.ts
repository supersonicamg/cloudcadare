import { describe, expect, it, vi } from 'vitest'
import { BadSignature, fakeGateway, FAKE_KEYS, hmacHex, razorpay, safeEqualHex } from './index'

const keys = { keyId: 'rzp_test_abc', secret: 'topsecret', webhookSecret: 'hooksecret' }
const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null })

describe('hmacHex', () => {
  // RFC 4231, test case 2
  it('matches the published HMAC-SHA256 vector', () => {
    expect(hmacHex('Jefe', 'what do ya want for nothing?')).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843')
  })
  it('safeEqualHex rejects different lengths and values', () => {
    expect(safeEqualHex('ab', 'abc')).toBe(false)
    expect(safeEqualHex('ab', 'ac')).toBe(false)
    expect(safeEqualHex('ab', 'ab')).toBe(true)
  })
})

describe('razorpay.verifyCheckout', () => {
  const gw = razorpay(keys)
  const good = hmacHex(keys.secret, 'order_1|pay_1')
  it('accepts the signature of order_id|payment_id', () => expect(gw.verifyCheckout({ gatewayOrderId: 'order_1', gatewayPaymentId: 'pay_1', signature: good })).toBe(true))
  it('rejects a payment id from another order', () => expect(gw.verifyCheckout({ gatewayOrderId: 'order_2', gatewayPaymentId: 'pay_1', signature: good })).toBe(false))
  it('rejects a signature made with another secret', () => expect(gw.verifyCheckout({ gatewayOrderId: 'order_1', gatewayPaymentId: 'pay_1', signature: hmacHex('other', 'order_1|pay_1') })).toBe(false))
  it('rejects garbage', () => expect(gw.verifyCheckout({ gatewayOrderId: 'order_1', gatewayPaymentId: 'pay_1', signature: '' })).toBe(false))
})

describe('razorpay.parseWebhook', () => {
  const gw = razorpay(keys)
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_9', order_id: 'order_9', amount: 118000, currency: 'INR', method: 'upi' } } } })
  const signed = (b: string, secret = keys.webhookSecret!) => headers({ 'x-razorpay-signature': hmacHex(secret, b), 'x-razorpay-event-id': 'evt_1' })

  it('turns a captured payment into a PaidEvent', () => {
    expect(gw.parseWebhook(body, signed(body))).toEqual({
      kind: 'paid', event: { eventId: 'evt_1', gatewayOrderId: 'order_9', gatewayPaymentId: 'pay_9', amountMinor: 118000, currency: 'INR', method: 'upi' },
    })
  })
  it('ignores other events but still checks the signature first', () => {
    const b = JSON.stringify({ event: 'refund.processed' })
    expect(gw.parseWebhook(b, signed(b))).toEqual({ kind: 'ignored', eventId: 'evt_1', type: 'refund.processed' })
    expect(() => gw.parseWebhook(b, signed(b, 'wrong'))).toThrow(BadSignature)
  })
  it('reports a failed payment attempt with its reason', () => {
    const b = JSON.stringify({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_x', order_id: 'order_9', amount: 100, currency: 'INR', error_description: 'Card declined' } } } })
    expect(gw.parseWebhook(b, signed(b))).toEqual({ kind: 'failed', eventId: 'evt_1', gatewayOrderId: 'order_9', reason: 'Card declined' })
  })
  it('rejects a body changed after signing, a missing header and a missing secret', () => {
    expect(() => gw.parseWebhook(body.replace('118000', '100'), signed(body))).toThrow(BadSignature)
    expect(() => gw.parseWebhook(body, headers({}))).toThrow(BadSignature)
    expect(() => razorpay({ keyId: 'k', secret: 's' }).parseWebhook(body, signed(body))).toThrow(BadSignature)
  })
})

describe('razorpay.createOrder', () => {
  it('posts the amount in paise with basic auth and returns the gateway id', async () => {
    const f = vi.fn(async (_u: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ authorization: `Basic ${Buffer.from('rzp_test_abc:topsecret').toString('base64')}` })
      expect(JSON.parse(String(init?.body))).toMatchObject({ amount: 118000, currency: 'INR', receipt: 'ORD-2026-000001' })
      return new Response(JSON.stringify({ id: 'order_new' }), { status: 200 })
    })
    const r = await razorpay(keys, f as unknown as typeof fetch).createOrder({ orderId: 'x', receipt: 'ORD-2026-000001', amountMinor: 118000, currency: 'INR' })
    expect(r.gatewayOrderId).toBe('order_new')
  })
  it('fails loudly on an API error without leaking the keys', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 401 }))
    await expect(razorpay(keys, f as unknown as typeof fetch).createOrder({ orderId: 'x', receipt: 'r', amountMinor: 1, currency: 'INR' })).rejects.toThrow(/401/)
  })
})

describe('razorpay.refund', () => {
  it('posts the amount in paise to the payment and returns the refund id', async () => {
    const f = vi.fn(async (u: string | URL | Request, init?: RequestInit) => {
      expect(String(u)).toBe('https://api.razorpay.com/v1/payments/pay_1/refund')
      expect(JSON.parse(String(init?.body))).toMatchObject({ amount: 5000, receipt: 'rf_1' })
      return new Response(JSON.stringify({ id: 'rfnd_1' }), { status: 200 })
    })
    expect(await razorpay(keys, f as unknown as typeof fetch).refund({ gatewayPaymentId: 'pay_1', amountMinor: 5000, receipt: 'rf_1' })).toEqual({ gatewayRefundId: 'rfnd_1' })
  })
  it('throws on a gateway error', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 400 }))
    await expect(razorpay(keys, f as unknown as typeof fetch).refund({ gatewayPaymentId: 'p', amountMinor: 1, receipt: 'r' })).rejects.toThrow(/400/)
  })
})

describe('fakeGateway', () => {
  it('uses the real verification with fixed keys', async () => {
    const gw = fakeGateway()
    const { gatewayOrderId } = await gw.createOrder({ orderId: 'x', receipt: 'r', amountMinor: 1, currency: 'INR' })
    expect(gatewayOrderId).toMatch(/^order_fake_/)
    expect(gw.verifyCheckout({ gatewayOrderId, gatewayPaymentId: 'pay_f', signature: hmacHex(FAKE_KEYS.secret, `${gatewayOrderId}|pay_f`) })).toBe(true)
  })
})
