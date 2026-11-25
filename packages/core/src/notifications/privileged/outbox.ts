import 'server-only'
import { getPlane } from '@educore/auth'
import { createPrivilegedDb } from '@educore/auth/privileged'
import type { Database } from '@educore/db/types'
import { isEnabled } from '@educore/features'
import { emailSenderFromEnv, type EmailSender } from '@educore/integrations/email'
import { loadTenantBundle } from '@educore/tenancy/privileged/load-tenant'
import { REJECT_REASON_TEXT } from '../../commerce/upi'
import { renderTemplate, safeDisplayName, textToHtml } from '../render'

// THE EMAIL WORKER. Domain events sit in `outbox_events` (written in the same transaction as the change they describe).
// processOutbox claims a batch (each event is claimed by one worker at a time), turns the ones that mean "tell the
// person" into emails, and records every send in `message_deliveries`. A failure is retried with a growing delay.
// Called from a cron route and, so mail goes out within seconds, right after the actions that create events.

type OutboxEvent = Database['public']['Tables']['outbox_events']['Row']
const db = () => createPrivilegedDb(getPlane(null))
const STALE_MS = 2 * 24 * 3600 * 1000

export interface OutboxResult { claimed: number; sent: number; skipped: number; failed: number }

const inr = (minor: number, currency: string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100)

export async function processOutbox(opts: { limit?: number; origin: (slug: string) => string }): Promise<OutboxResult> {
  const d = db()
  const sender = emailSenderFromEnv()
  const res: OutboxResult = { claimed: 0, sent: 0, skipped: 0, failed: 0 }
  const { data: events, error } = await d.rpc('claim_outbox_events', { p_limit: opts.limit ?? 20 })
  if (error) throw new Error(`outbox claim failed: ${error.message}`)
  for (const ev of events ?? []) {
    res.claimed++
    try {
      const outcome = await handle(ev, sender, opts.origin)
      res[outcome]++
      await d.rpc('finish_outbox_event', { p_id: ev.id })
    } catch (e) {
      res.failed++
      await d.rpc('finish_outbox_event', { p_id: ev.id, p_error: e instanceof Error ? e.message : String(e) })
    }
  }
  return res
}

interface Mail { tenantId: string; memberId: string; eventKey: string; vars: Record<string, string> }

async function handle(ev: OutboxEvent, sender: EmailSender | null, origin: (slug: string) => string): Promise<'sent' | 'skipped'> {
  if (Date.now() - new Date(ev.created_at).getTime() > STALE_MS) return 'skipped' // do not mail about old news after an outage
  const d = db()
  const payload = (ev.payload ?? {}) as Record<string, unknown>
  const memberId = typeof payload.member_id === 'string' ? payload.member_id : null
  if (!memberId || !ev.aggregate_id) return 'skipped'
  const { data: tenant } = await d.from('tenants').select('slug, name').eq('id', ev.tenant_id).maybeSingle()
  if (!tenant) return 'skipped'
  const base = origin(tenant.slug)
  const common = { 'tenant.name': tenant.name, 'links.learn': `${base}/learn` }

  let mail: Mail | null = null
  if (ev.event_type === 'order.paid' || ev.event_type === 'order.refunded') {
    const { data: o } = await d.from('orders').select('order_no, total_minor, currency, order_items(title_snapshot)').eq('id', ev.aggregate_id).maybeSingle()
    if (!o) return 'skipped'
    const refunded = ev.event_type === 'order.refunded'
    mail = {
      tenantId: ev.tenant_id, memberId, eventKey: refunded ? 'order.refunded' : 'order.receipt',
      vars: {
        ...common, 'order.no': o.order_no, 'order.total': inr(o.total_minor, o.currency), 'order.items': o.order_items.map((i) => i.title_snapshot).join(', '),
        'refund.amount': inr(Number(payload.amount_minor ?? 0), o.currency), 'links.receipt': `${base}/orders/${ev.aggregate_id}`,
      },
    }
  } else if (ev.event_type === 'certificate.issued') {
    const { data: c } = await d.from('certificates').select('title, verification_code').eq('id', ev.aggregate_id).maybeSingle()
    if (!c) return 'skipped'
    mail = { tenantId: ev.tenant_id, memberId, eventKey: 'certificate.issued', vars: { ...common, 'course.title': c.title, 'links.certificate': `${base}/certificates/${ev.aggregate_id}`, 'links.verify': `${base}/verify/${c.verification_code}` } }
  } else if (ev.event_type === 'payment.pending') {
    // "We are checking your payment": the learner pressed "I have paid" (plan/16 §5.6). Email only; WhatsApp is by hand.
    const [{ data: o }, { data: st }] = await Promise.all([
      d.from('orders').select('order_no').eq('id', ev.aggregate_id).maybeSingle(),
      d.from('tenant_settings').select('commerce').eq('tenant_id', ev.tenant_id).maybeSingle(),
    ])
    if (!o) return 'skipped'
    const sla = String(((st?.commerce as { upi?: { sla_text?: string } } | null)?.upi?.sla_text) ?? '').slice(0, 80)
    mail = {
      tenantId: ev.tenant_id, memberId, eventKey: 'payment.pending',
      vars: { ...common, 'order.no': o.order_no, 'links.order': `${base}/checkout/${ev.aggregate_id}/pending`, 'payment.sla': sla ? `We usually check it ${sla.replace(/^usually\s+/i, '')}.` : '' },
    }
  } else if (ev.event_type === 'payment.needs_action') {
    // Staff sent the payment back (plan/16 §5.3, §5.6): the reason from the fixed list, the staff note, and the way forward.
    const { data: o } = await d.from('orders').select('order_no').eq('id', ev.aggregate_id).maybeSingle()
    if (!o) return 'skipped'
    const reason = typeof payload.reason === 'string' ? (REJECT_REASON_TEXT[payload.reason] ?? '') : ''
    const note = typeof payload.note === 'string' ? payload.note.trim().slice(0, 500) : ''
    mail = {
      tenantId: ev.tenant_id, memberId, eventKey: 'payment.needs_action',
      vars: { ...common, 'order.no': o.order_no, 'links.order': `${base}/checkout/${ev.aggregate_id}/pending`, 'payment.reason': reason, 'payment.note': note ? `\n\nFrom our team: ${note}` : '' },
    }
  } else if (ev.event_type === 'whitelist.claimed') {
    const { data: e } = await d.from('enrollments').select('courses(title)').eq('id', ev.aggregate_id).maybeSingle()
    const course = Array.isArray(e?.courses) ? e?.courses[0] : e?.courses
    mail = { tenantId: ev.tenant_id, memberId, eventKey: 'whitelist.claimed', vars: { ...common, 'course.title': course?.title ?? 'your course' } }
  }
  if (!mail) return 'skipped'
  return sendTemplated(mail, sender)
}

/** One templated email to one member. Honours the academy's email module, the member's preference and the stored template. */
async function sendTemplated(m: Mail, sender: EmailSender | null): Promise<'sent' | 'skipped'> {
  const d = db()
  const { data: tenant } = await d.from('tenants').select('slug').eq('id', m.tenantId).maybeSingle()
  const bundle = tenant ? await loadTenantBundle(tenant.slug) : null
  if (!bundle || !isEnabled(bundle.features, 'comms.email')) return 'skipped'

  const { data: member } = await d.from('tenant_members').select('display_name, email').eq('id', m.memberId).maybeSingle()
  if (!member?.email) return 'skipped'
  const { data: off } = await d.from('notification_preferences').select('event_key')
    .eq('member_id', m.memberId).eq('channel', 'email').eq('enabled', false).in('event_key', [m.eventKey, '*']).limit(1)
  if (off?.length) return 'skipped'

  const { data: rows } = await d.from('notification_templates').select('tenant_id, subject, body')
    .eq('event_key', m.eventKey).eq('channel', 'email').eq('locale', 'en').eq('is_active', true).or(`tenant_id.eq.${m.tenantId},tenant_id.is.null`)
  const tpl = rows?.find((r) => r.tenant_id === m.tenantId) ?? rows?.find((r) => r.tenant_id === null)
  if (!tpl?.subject) return 'skipped'

  const vars = { ...m.vars, 'member.name': member.display_name }
  const text = renderTemplate(tpl.body, vars)
  const subject = renderTemplate(tpl.subject, vars).replace(/[\r\n]+/g, ' ').slice(0, 200)
  const address = process.env.EMAIL_FROM_ADDRESS || `noreply@${process.env.BASE_DOMAIN ?? 'localhost'}`
  const from = `${safeDisplayName(bundle.branding.displayName)} <${address}>`

  const row = { tenant_id: m.tenantId, member_id: m.memberId, channel: 'email', event_key: m.eventKey, recipient: member.email, provider: sender?.name ?? 'none' }
  if (!sender) {
    await d.from('message_deliveries').insert({ ...row, status: 'failed', error: 'email_not_configured' })
    return 'skipped'
  }
  try {
    const sent = await sender.send({ from, to: member.email, subject, text, html: textToHtml(text) })
    await d.from('message_deliveries').insert({ ...row, status: 'sent', provider_message_id: sent.id })
    return 'sent'
  } catch (e) {
    await d.from('message_deliveries').insert({ ...row, status: 'failed', error: (e instanceof Error ? e.message : String(e)).slice(0, 300) })
    throw e
  }
}
