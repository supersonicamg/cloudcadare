import { assertHeaderSafe, type EmailSender } from './port'

// Resend: POST https://api.resend.com/emails with a bearer API key. The sending domain must be verified in Resend.

export function resend(apiKey: string, fetchImpl: typeof fetch = fetch): EmailSender {
  return {
    name: 'resend',
    async send(m) {
      assertHeaderSafe(m.from, m.to, m.subject, m.replyTo)
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ from: m.from, to: [m.to], subject: m.subject, text: m.text, html: m.html, reply_to: m.replyTo }),
      })
      if (!res.ok) throw new Error(`Resend failed (${res.status})`)
      const body = (await res.json().catch(() => ({}))) as { id?: string }
      return { id: body.id ?? null }
    },
  }
}
