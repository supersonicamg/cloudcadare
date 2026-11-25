import { createHmac, timingSafeEqual } from 'node:crypto'

export const hmacHex = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('hex')

/** Constant-time comparison of two hex strings of any length. */
export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8')
  const y = Buffer.from(b, 'utf8')
  return x.length === y.length && timingSafeEqual(x, y)
}
