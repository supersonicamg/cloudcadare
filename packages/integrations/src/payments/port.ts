// Payments port. Domain code talks to this interface; one adapter per gateway (plan/09 §1).
// Adapters are pure with respect to our database: they never read or write it. Callers pass in the keys.

export interface GatewayKeys {
  keyId: string
  secret: string
  webhookSecret?: string | null
}

export interface GatewayOrder {
  /** The gateway's id for this payment attempt (Razorpay `order_…`). */
  gatewayOrderId: string
}

/** A payment the gateway says is paid, normalised across gateways. */
export interface PaidEvent {
  /** Gateway event id, used to ignore redeliveries. */
  eventId: string
  gatewayOrderId: string
  gatewayPaymentId: string
  amountMinor: number
  currency: string
  method: string | null
}

export type WebhookResult =
  | { kind: 'paid'; event: PaidEvent }
  /** A payment attempt failed. The Razorpay order stays open: the learner may try again inside the same checkout. */
  | { kind: 'failed'; eventId: string; gatewayOrderId: string; reason: string }
  | { kind: 'ignored'; eventId: string; type: string }

export interface PaymentGateway {
  readonly name: 'razorpay' | 'fake'
  createOrder(i: { orderId: string; receipt: string; amountMinor: number; currency: string; notes?: Record<string, string> }): Promise<GatewayOrder>
  /** True when the browser's checkout result is genuine (the signature binds payment id to our order id). */
  verifyCheckout(i: { gatewayOrderId: string; gatewayPaymentId: string; signature: string }): boolean
  /** Throws `BadSignature` when the signature does not match the raw body. */
  parseWebhook(rawBody: string, headers: { get(name: string): string | null }): WebhookResult
  /** Sends money back for one captured payment. `receipt` is our own refund id, so a retry is recognisable. */
  refund(i: { gatewayPaymentId: string; amountMinor: number; receipt: string }): Promise<{ gatewayRefundId: string }>
}

export class BadSignature extends Error {
  constructor() { super('Invalid signature'); this.name = 'BadSignature' }
}
