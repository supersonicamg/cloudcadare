import type { EmailSender } from './port'
import { resend } from './resend'
import { smtpDev } from './smtp-dev'

export * from './port'
export * from './resend'
export * from './smtp-dev'

/**
 * RESEND_API_KEY set: Resend. Otherwise, outside production: the local mail sink (SMTP_DEV_HOST / SMTP_DEV_PORT,
 * default 127.0.0.1:54325). Otherwise null: the caller records "email is not configured" instead of failing silently.
 */
export function emailSenderFromEnv(env: Record<string, string | undefined> = process.env): EmailSender | null {
  if (env.RESEND_API_KEY) return resend(env.RESEND_API_KEY)
  if (env.NODE_ENV !== 'production') return smtpDev(env.SMTP_DEV_HOST || '127.0.0.1', Number(env.SMTP_DEV_PORT) || 54325)
  return null
}
