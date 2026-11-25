import 'server-only'
import { getPlane } from '@educore/auth'
import { createPrivilegedDb } from '@educore/auth/privileged'
import type { Json } from '@educore/db/types'
import { BadSignature, type PaidEvent } from '@educore/integrations/payments'
import { loadGateway } from './gateway'

// Money paths. Only these functions create payments or mark orders paid, and only after the gateway's
// signature was verified. They never trust amounts from the browser: the amount is the order's own total.

const db = () => createPrivilegedDb(getPlane(null))

export interface CheckoutStart { gatewayOrderId: string; keyId: string; mode: 'test' | 'live' | 'fake' }

/** Creates the gateway-side order and remembers it, so the confirmation can be tied back to our order. */
export async function startGatewayPayment(i: { tenantId: string; orderId: string }): Promise<CheckoutStart | { error: 'gateway_not_configured' }> {
  const gw = await loadGateway(i.tenantId)
  if (!gw) return { error: 'gateway_not_configured' }
  const d = db()
  const { data: order, error } = await d.from('orders').select('id, order_no, total_minor, currency, status')
    .eq('tenant_id', i.tenantId).eq('id', i.orderId).maybeSingle()
  if (error || !order) throw new Error('order not found')
  if (order.status !== 'awaiting_payment') throw new Error('order is not payable')

  // reuse the gateway order of a resumed checkout
  const { data: existing } = await d.from('payments').select('gateway_order_id')
    .eq('tenant_id', i.tenantId).eq('order_id', order.id).eq('status', 'created').not('gateway_order_id', 'is', null).limit(1).maybeSingle()
  if (existing?.gateway_order_id) return { gatewayOrderId: existing.gateway_order_id, keyId: gw.keyId, mode: gw.mode }

  const created = await gw.gateway.createOrder({ orderId: order.id, receipt: order.order_no, amountMinor: order.total_minor, currency: order.currency })
  const { error: insErr } = await d.from('payments').insert({
    tenant_id: i.tenantId, order_id: order.id, gateway: 'razorpay', gateway_order_id: created.gatewayOrderId,
    amount_minor: order.total_minor, currency: order.currency, status: 'created',
  })
  if (insErr) throw new Error(`payment row failed: ${insErr.message}`)
  return { gatewayOrderId: created.gatewayOrderId, keyId: gw.keyId, mode: gw.mode }
}

export type ConfirmResult = { ok: true; already: boolean } | { ok: false; reason: 'bad_signature' | 'unknown_order' | 'gateway_not_configured' | 'amount_mismatch' | 'failed' }

async function fulfil(tenantId: string, orderId: string, p: { gatewayOrderId: string; gatewayPaymentId: string; amountMinor: number; method: string | null; raw: Json }): Promise<ConfirmResult> {
  const { data, error } = await db().rpc('fulfil_order', {
    p_order_id: orderId, p_gateway: 'razorpay', p_gateway_order_id: p.gatewayOrderId, p_gateway_payment_id: p.gatewayPaymentId,
    p_amount_minor: p.amountMinor, p_method: p.method ?? undefined, p_raw: p.raw,
  })
  void tenantId
  if (error) return { ok: false, reason: error.message.includes('amount_mismatch') ? 'amount_mismatch' : 'failed' }
  return { ok: true, already: Boolean((data as { already?: boolean } | null)?.already) }
}

/** The browser came back from Razorpay Checkout. Verified with the key secret; the amount is OUR order total. */
export async function confirmCheckout(i: {
  tenantId: string; orderId: string; gatewayOrderId: string; gatewayPaymentId: string; signature: string
}): Promise<ConfirmResult> {
  const gw = await loadGateway(i.tenantId)
  if (!gw) return { ok: false, reason: 'gateway_not_configured' }
  const d = db()
  const { data: pay } = await d.from('payments').select('order_id, amount_minor')
    .eq('tenant_id', i.tenantId).eq('order_id', i.orderId).eq('gateway_order_id', i.gatewayOrderId).eq('status', 'created').maybeSingle()
  if (!pay) {
    // a redelivery after success is fine: report it as already done
    const { data: done } = await d.from('orders').select('status').eq('tenant_id', i.tenantId).eq('id', i.orderId).maybeSingle()
    return done?.status === 'paid' ? { ok: true, already: true } : { ok: false, reason: 'unknown_order' }
  }
  if (!gw.gateway.verifyCheckout({ gatewayOrderId: i.gatewayOrderId, gatewayPaymentId: i.gatewayPaymentId, signature: i.signature })) {
    return { ok: false, reason: 'bad_signature' }
  }
  return fulfil(i.tenantId, i.orderId, { gatewayOrderId: i.gatewayOrderId, gatewayPaymentId: i.gatewayPaymentId, amountMinor: pay.amount_minor, method: null, raw: { source: 'checkout' } })
}

export interface WebhookOutcome { status: number; body: { ok: boolean; note?: string } }

/**
 * Razorpay webhook. Signature first; then the inbox (dedupe on event id); then fulfilment. Permanent
 * problems (unknown order, wrong amount) are recorded and answered 200 so the gateway stops retrying;
 * transient ones answer 500 so it retries.
 */
export async function handleWebhook(tenantId: string, rawBody: string, headers: { get(name: string): string | null }): Promise<WebhookOutcome> {
  const gw = await loadGateway(tenantId)
  if (!gw) return { status: 404, body: { ok: false } }
  let result
  try { result = gw.gateway.parseWebhook(rawBody, headers) } catch (e) {
    if (e instanceof BadSignature) return { status: 401, body: { ok: false } }
    throw e
  }

  const d = db()
  const eventId = result.kind === 'paid' ? result.event.eventId : result.eventId
  const type = result.kind === 'paid' ? 'payment.captured' : result.kind === 'failed' ? 'payment.failed' : result.type
  // Store only what we need: no customer contact data from the gateway payload.
  const payload: Json = result.kind === 'paid'
    ? { order_id: result.event.gatewayOrderId, payment_id: result.event.gatewayPaymentId, amount: result.event.amountMinor, currency: result.event.currency }
    : result.kind === 'failed' ? { order_id: result.gatewayOrderId, reason: result.reason } : { type }
  const ins = await d.from('gateway_webhook_inbox').insert({ tenant_id: tenantId, gateway: 'razorpay', event_id: eventId, event_type: type, payload })
  if (ins.error) {
    if (ins.error.code !== '23505') return { status: 500, body: { ok: false } }
    const { data: prev } = await d.from('gateway_webhook_inbox').select('processed_at').eq('gateway', 'razorpay').eq('event_id', eventId).maybeSingle()
    if (prev?.processed_at) return { status: 200, body: { ok: true, note: 'duplicate' } }
  }
  const finish = (error: string | null) =>
    d.from('gateway_webhook_inbox').update({ processed_at: new Date().toISOString(), last_error: error }).eq('gateway', 'razorpay').eq('event_id', eventId)

  if (result.kind === 'ignored') { await finish(null); return { status: 200, body: { ok: true, note: 'ignored' } } }

  if (result.kind === 'failed') {
    // Only remember why, so the checkout page can say so. The gateway order stays open and payable: Razorpay
    // lets the learner retry inside the same order, and a success afterwards must still be accepted.
    await d.from('payments').update({ failure_reason: result.reason }).eq('tenant_id', tenantId).eq('gateway_order_id', result.gatewayOrderId).eq('status', 'created')
    await finish(null)
    return { status: 200, body: { ok: true, note: 'failure recorded' } }
  }

  const ev: PaidEvent = result.event
  const { data: pay } = await d.from('payments').select('order_id').eq('tenant_id', tenantId).eq('gateway_order_id', ev.gatewayOrderId).limit(1).maybeSingle()
  if (!pay) { await finish('unknown_order'); return { status: 200, body: { ok: true, note: 'unknown order' } } }

  const r = await fulfil(tenantId, pay.order_id, { gatewayOrderId: ev.gatewayOrderId, gatewayPaymentId: ev.gatewayPaymentId, amountMinor: ev.amountMinor, method: ev.method, raw: { source: 'webhook', event: eventId } })
  if (r.ok) { await finish(null); return { status: 200, body: { ok: true, note: r.already ? 'already paid' : 'paid' } } }
  if (r.reason === 'amount_mismatch') { await finish('amount_mismatch'); return { status: 200, body: { ok: true, note: 'amount mismatch recorded' } } }
  await d.from('gateway_webhook_inbox').update({ last_error: r.reason }).eq('gateway', 'razorpay').eq('event_id', eventId)
  return { status: 500, body: { ok: false } }
}

/** A 100%-off order has no gateway payment. The order's own total must be 0; the database refuses anything else. */
export async function completeFreeOrder(i: { orderId: string }): Promise<{ ok: boolean }> {
  const { error } = await db().rpc('fulfil_order', { p_order_id: i.orderId, p_gateway: 'free', p_gateway_order_id: `free:${i.orderId}`, p_gateway_payment_id: `free:${i.orderId}`, p_amount_minor: 0 })
  return { ok: !error }
}

export type RefundResult = { ok: true; orderStatus: string } | { ok: false; reason: 'not_refundable' | 'amount_invalid' | 'gateway_not_configured' | 'gateway_failed' }

/**
 * Staff refund. The caller has already checked `refund.manage` and the MFA step. Three steps so that a gateway call
 * never happens without a row remembering it: a pending refund row, the gateway call, then the outcome is settled.
 * If the gateway call fails the row is closed as failed and nothing else changes.
 */
export async function refundOrder(i: { tenantId: string; orderId: string; amountMinor: number; reason: string | null; revokeAccess: boolean; staffMemberId: string }): Promise<RefundResult> {
  const gw = await loadGateway(i.tenantId)
  if (!gw) return { ok: false, reason: 'gateway_not_configured' }
  const d = db()
  const begun = await d.rpc('begin_refund', { p_order_id: i.orderId, p_amount_minor: i.amountMinor, p_reason: i.reason ?? '', p_revoke_access: i.revokeAccess, p_staff_member: i.staffMemberId })
  if (begun.error) return { ok: false, reason: begun.error.message.includes('refund_amount_invalid') ? 'amount_invalid' : 'not_refundable' }
  const b = begun.data as { refund_id: string; gateway_payment_id: string | null; amount_minor: number }
  if (!b.gateway_payment_id) { await d.rpc('finish_refund', { p_refund_id: b.refund_id, p_ok: false }); return { ok: false, reason: 'not_refundable' } }

  let gatewayRefundId: string
  try {
    gatewayRefundId = (await gw.gateway.refund({ gatewayPaymentId: b.gateway_payment_id, amountMinor: b.amount_minor, receipt: b.refund_id })).gatewayRefundId
  } catch {
    await d.rpc('finish_refund', { p_refund_id: b.refund_id, p_ok: false })
    return { ok: false, reason: 'gateway_failed' }
  }
  const fin = await d.rpc('finish_refund', { p_refund_id: b.refund_id, p_ok: true, p_gateway_refund_id: gatewayRefundId })
  if (fin.error) throw new Error(`refund ${b.refund_id} went through at the gateway (${gatewayRefundId}) but could not be recorded: ${fin.error.message}`)
  return { ok: true, orderStatus: (fin.data as { order_status?: string } | null)?.order_status ?? 'refunded' }
}
