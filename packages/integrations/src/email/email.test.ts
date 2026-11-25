import { describe, expect, it, vi } from 'vitest'
import { assertHeaderSafe, emailSenderFromEnv, resend, smtpDev } from './index'

describe('email senders', () => {
  it('posts a Resend message with the bearer key and returns its id', async () => {
    const f = vi.fn(async (_u: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ authorization: 'Bearer re_key' })
      expect(JSON.parse(String(init?.body))).toMatchObject({ from: 'A <a@x.test>', to: ['b@y.test'], subject: 'Hi', text: 'Body' })
      return new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 })
    })
    expect(await resend('re_key', f as unknown as typeof fetch).send({ from: 'A <a@x.test>', to: 'b@y.test', subject: 'Hi', text: 'Body' })).toEqual({ id: 'msg_1' })
  })
  it('throws on a Resend error without echoing the key', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 422 }))
    await expect(resend('re_secret', f as unknown as typeof fetch).send({ from: 'a@x.test', to: 'b@y.test', subject: 's', text: 't' })).rejects.toThrow('Resend failed (422)')
  })
  it('refuses header injection', () => {
    expect(() => assertHeaderSafe('Subject\r\nBcc: x@y.test')).toThrow()
    expect(() => assertHeaderSafe('Fine subject', undefined)).not.toThrow()
  })
  it('only talks SMTP to loopback', () => {
    expect(() => smtpDev('mail.example.com')).toThrow(/loopback/)
    expect(() => smtpDev('127.0.0.1', 1)).not.toThrow()
  })
  it('picks the sender from the environment', () => {
    expect(emailSenderFromEnv({ RESEND_API_KEY: 'k', NODE_ENV: 'production' })?.name).toBe('resend')
    expect(emailSenderFromEnv({ NODE_ENV: 'development' })?.name).toBe('smtp-dev')
    expect(emailSenderFromEnv({ NODE_ENV: 'production' })).toBeNull()
  })
})
