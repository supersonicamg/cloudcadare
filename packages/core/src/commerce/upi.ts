import { z } from 'zod'
import QRCode from 'qrcode'
import { normaliseWhatsapp } from '../accounts'

// UPI payments the academy collects itself (plan/16 §3.4, §5). Pure helpers plus the QR drawing; no database here.
// Settings live in tenant_settings.commerce.upi. Never put a secret in them: the UPI ID is public by nature.

const VPA = /^[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}$/

export interface UpiSettings {
  enabled: boolean
  vpa: string
  payeeName: string
  whatsappNumber: string
  hoursText: string
  slaText: string
  alertEmail: string
  /** Razorpay shows as "Coming soon" and cannot be chosen while this is true and no gateway keys exist. */
  razorpayComingSoon: boolean
}

const str = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Reads what is stored, tolerating a missing or half-filled object. `enabled` is true only with a valid UPI ID. */
export function readUpiSettings(raw: unknown): UpiSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const vpa = str(o.vpa, 80)
  return {
    enabled: o.enabled === true && VPA.test(vpa),
    vpa,
    payeeName: str(o.payee_name, 60),
    whatsappNumber: str(o.whatsapp_number, 20),
    hoursText: str(o.hours_text, 80),
    slaText: str(o.sla_text, 80),
    alertEmail: str(o.alert_email, 254),
    razorpayComingSoon: o.razorpay_coming_soon !== false,
  }
}

/** The D3 form: what staff may type. Returns the JSON stored under commerce.upi (snake_case, as the database expects). */
export const upiFormSchema = z.object({
  enabled: z.boolean(),
  vpa: z.string().trim().max(80),
  payee_name: z.string().trim().min(1, 'Enter the name shown in the learner’s UPI app.').max(60),
  whatsapp_number: z.string().trim().max(20).transform((v, ctx) => {
    if (!v) return ''
    const n = normaliseWhatsapp(v)
    if (n) return n
    ctx.addIssue({ code: 'custom', message: 'Enter a 10-digit mobile number, or start with + and the country code.' })
    return z.NEVER
  }),
  hours_text: z.string().trim().max(80),
  sla_text: z.string().trim().max(80),
  alert_email: z.union([z.literal(''), z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.').max(254))]),
  razorpay_coming_soon: z.boolean(),
}).superRefine((v, ctx) => {
  if (v.enabled && !VPA.test(v.vpa)) ctx.addIssue({ code: 'custom', path: ['vpa'], message: 'A UPI ID looks like name@bank.' })
  if (v.enabled && !v.whatsapp_number) ctx.addIssue({ code: 'custom', path: ['whatsapp_number'], message: 'Learners send their screenshot to this number. Enter it.' })
})

/** 4999900 paise -> "49999.00": the form UPI apps expect in the `am` field. */
export const upiAmount = (minor: number) => (minor / 100).toFixed(2)

/**
 * The payment link inside the QR (and behind "Open UPI app" on phones). Amount and note are filled in, so the learner
 * cannot mistype them: `upi://pay?pa=<vpa>&pn=<payee>&am=49999.00&tn=<order no>&cu=INR`.
 */
export function upiPayLink(o: { vpa: string; payeeName: string; amountMinor: number; note: string }): string {
  if (!VPA.test(o.vpa)) throw new Error('invalid UPI ID')
  if (!Number.isInteger(o.amountMinor) || o.amountMinor <= 0) throw new Error('invalid amount')
  const q = [
    ['pa', o.vpa], ['pn', o.payeeName], ['am', upiAmount(o.amountMinor)], ['tn', o.note], ['cu', 'INR'],
  ].map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&')
  return `upi://pay?${q}`
}

/** wa.me link with the order number already typed, so the learner only attaches the picture. */
export function whatsappScreenshotLink(number: string, orderNo: string, courseTitle?: string): string | null {
  const digits = number.replace(/\D/g, '')
  if (digits.length < 8) return null
  const text = `Hi, my ${courseTitle ? `${courseTitle} ` : ''}order is ${orderNo}. Payment screenshot attached.`
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

/** The QR as inline SVG, drawn on the server (no third-party image service). Dark modules follow the text colour. */
export async function upiQrSvg(link: string): Promise<string> {
  return QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#14201F', light: '#FFFFFF' } })
}

// ---- Screenshots of the payment (plan/16 §5.2): jpg, png or pdf, 5 MB, judged by content.
export const PROOF_EXTS = ['jpg', 'jpeg', 'png', 'pdf'] as const
export const PROOF_MAX_BYTES = 5 * 1024 * 1024
export type ProofKind = 'jpg' | 'png' | 'pdf'

/** Looks at the first bytes of a file. A renamed script or a text file is `null`, whatever its name says. */
export function sniffProof(head: Uint8Array): ProofKind | null {
  const is = (...b: number[]) => b.every((v, i) => head[i] === v)
  if (is(0xff, 0xd8, 0xff)) return 'jpg'
  if (is(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png'
  if (is(0x25, 0x50, 0x44, 0x46, 0x2d)) return 'pdf'
  return null
}

/** The twelve-number UPI reference (UTR). Spaces are ignored; anything else is refused; empty stays empty. */
export function normaliseUtr(raw: string): string | null {
  const v = raw.replace(/\s/g, '')
  return /^\d{12}$/.test(v) ? v : v === '' ? '' : null
}
