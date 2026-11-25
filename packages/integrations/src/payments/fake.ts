import { randomUUID } from 'node:crypto'
import { razorpay } from './razorpay'
import type { GatewayKeys, PaymentGateway } from './port'

// A stand-in for Razorpay for local development and browser tests: same signatures, no network.
// It reuses the real Razorpay verification code with fixed keys, so what the tests prove about
// signature checking is the code that runs in production. The app refuses to use it in production.

export const FAKE_KEYS: GatewayKeys = { keyId: 'fake_key_id', secret: 'fake_secret', webhookSecret: 'fake_webhook_secret' }

export function fakeGateway(): PaymentGateway {
  const real = razorpay(FAKE_KEYS)
  return { ...real, name: 'fake', async createOrder() { return { gatewayOrderId: `order_fake_${randomUUID().replace(/-/g, '').slice(0, 14)}` } },
    async refund() { return { gatewayRefundId: `rfnd_fake_${randomUUID().replace(/-/g, '').slice(0, 14)}` } } }
}
