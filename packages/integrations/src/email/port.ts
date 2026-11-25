// Email port. Domain code builds a message and hands it to a sender; one adapter per provider (plan/09 §2).
// Adapters never read or write our database.

export interface EmailMessage {
  /** "Name <address>" or just an address. */
  from: string
  to: string
  subject: string
  text: string
  html?: string
  replyTo?: string
}

export interface EmailSender {
  readonly name: 'resend' | 'smtp-dev'
  send(m: EmailMessage): Promise<{ id: string | null }>
}

const HEADER_BREAKERS = /[\r\n]/
/** A header value must be one line, or a name could inject extra headers (`Bcc:`). */
export function assertHeaderSafe(...values: (string | undefined)[]) {
  for (const v of values) if (v && HEADER_BREAKERS.test(v)) throw new Error('Unsafe email header value')
}
