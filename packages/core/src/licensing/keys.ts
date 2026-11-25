import { createHash, randomBytes } from 'node:crypto'

// Crockford base32: no I, L, O, U, so keys survive being read over the phone.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** EDU-XXXX-XXXX-XXXX-XXXX (80 bits). Shown once; only the hash is stored. */
export function generateLicenseKey(): string {
  const bytes = randomBytes(16)
  const chars = Array.from(bytes, (b) => ALPHABET[b % 32]).join('').slice(0, 16)
  return `EDU-${chars.match(/.{4}/g)!.join('-')}`
}

export function normalizeLicenseKey(key: string): string {
  return key.trim().toUpperCase()
}

/** Must equal sha256(convert_to(upper(trim(key)), 'UTF8')) in control.redeem_license. */
export function hashLicenseKey(key: string): Buffer {
  return createHash('sha256').update(normalizeLicenseKey(key), 'utf8').digest()
}

export function licenseKeyHint(key: string): string {
  const k = normalizeLicenseKey(key)
  return `${k.slice(0, 8)}…${k.slice(-4)}`
}
