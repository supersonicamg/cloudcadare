import { describe, expect, it } from 'vitest'
import { normaliseUtr, readUpiSettings, sniffProof, upiAmount, upiFormSchema, upiPayLink, upiQrSvg, whatsappScreenshotLink } from './upi'

describe('upiPayLink', () => {
  it('fills in the amount (rupees, two decimals) and the order number', () => {
    const link = upiPayLink({ vpa: 'cloudcadre@okaxis', payeeName: 'CloudCadre', amountMinor: 4999900, note: 'CC-2026-000123' })
    expect(link).toBe('upi://pay?pa=cloudcadre%40okaxis&pn=CloudCadre&am=49999.00&tn=CC-2026-000123&cu=INR')
  })
  it('encodes spaces and symbols in the payee name', () => {
    const link = upiPayLink({ vpa: 'a.b@ybl', payeeName: 'Cloud & Cadre Pvt Ltd', amountMinor: 100, note: 'X' })
    expect(link).toContain('pn=Cloud%20%26%20Cadre%20Pvt%20Ltd')
    expect(link).not.toContain('+')
  })
  it('refuses a bad UPI ID or a zero or fractional amount', () => {
    expect(() => upiPayLink({ vpa: 'not a vpa', payeeName: 'X', amountMinor: 100, note: 'N' })).toThrow()
    expect(() => upiPayLink({ vpa: 'a@b.c', payeeName: 'X', amountMinor: 100, note: 'N' })).toThrow()
    expect(() => upiPayLink({ vpa: 'a@okaxis', payeeName: 'X', amountMinor: 0, note: 'N' })).toThrow()
    expect(() => upiPayLink({ vpa: 'a@okaxis', payeeName: 'X', amountMinor: 10.5, note: 'N' })).toThrow()
  })
  it('a top-up QR carries only the balance', () => {
    expect(upiAmount(999900)).toBe('9999.00')
    expect(upiAmount(5)).toBe('0.05')
  })
})

describe('whatsappScreenshotLink', () => {
  it('opens a chat with the order number already typed', () => {
    const link = whatsappScreenshotLink('+91 98765 43210', 'CC-2026-000123', 'CEAP')!
    expect(link.startsWith('https://wa.me/919876543210?text=')).toBe(true)
    expect(decodeURIComponent(link)).toContain('CC-2026-000123')
  })
  it('has no link without a number', () => expect(whatsappScreenshotLink('', 'CC-1')).toBeNull())
})

describe('readUpiSettings', () => {
  it('is switched off with no settings, a missing UPI ID, or a bad one', () => {
    expect(readUpiSettings(undefined).enabled).toBe(false)
    expect(readUpiSettings({ enabled: true }).enabled).toBe(false)
    expect(readUpiSettings({ enabled: true, vpa: 'bad' }).enabled).toBe(false)
    expect(readUpiSettings({ enabled: true, vpa: 'cloudcadre@okaxis' }).enabled).toBe(true)
  })
  it('keeps Razorpay as "coming soon" unless it was switched off on purpose', () => {
    expect(readUpiSettings({}).razorpayComingSoon).toBe(true)
    expect(readUpiSettings({ razorpay_coming_soon: false }).razorpayComingSoon).toBe(false)
  })
})

describe('upiFormSchema', () => {
  const base = { enabled: true, vpa: 'cloudcadre@okaxis', payee_name: 'CloudCadre', whatsapp_number: '98765 43210', hours_text: '', sla_text: '', alert_email: '', razorpay_coming_soon: true }
  it('normalises the WhatsApp number and accepts a good form', () => {
    const r = upiFormSchema.parse(base)
    expect(r.whatsapp_number).toBe('+919876543210')
  })
  it('needs a valid UPI ID and a WhatsApp number once switched on', () => {
    expect(upiFormSchema.safeParse({ ...base, vpa: 'nope' }).success).toBe(false)
    expect(upiFormSchema.safeParse({ ...base, whatsapp_number: '' }).success).toBe(false)
    expect(upiFormSchema.safeParse({ ...base, enabled: false, vpa: '', whatsapp_number: '' }).success).toBe(true)
  })
})

describe('upiQrSvg', () => {
  it('draws an svg on the server', async () => {
    const svg = await upiQrSvg('upi://pay?pa=a%40okaxis&am=1.00')
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('viewBox')
  })
})

describe('sniffProof', () => {
  it('knows a jpg, a png and a pdf by their first bytes', () => {
    expect(sniffProof(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg')
    expect(sniffProof(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png')
    expect(sniffProof(new TextEncoder().encode('%PDF-1.7'))).toBe('pdf')
  })
  it('refuses a script or a text file even if it is named like a picture', () => {
    expect(sniffProof(new TextEncoder().encode('<script>alert(1)</script>'))).toBeNull()
    expect(sniffProof(new TextEncoder().encode('GIF89a'))).toBeNull()
    expect(sniffProof(new Uint8Array())).toBeNull()
  })
})

describe('normaliseUtr', () => {
  it('takes exactly twelve numbers, with or without spaces', () => {
    expect(normaliseUtr('4012 3456 7890')).toBe('401234567890')
    expect(normaliseUtr('')).toBe('')
    expect(normaliseUtr('12345')).toBeNull()
    expect(normaliseUtr('40123456789a')).toBeNull()
  })
})
