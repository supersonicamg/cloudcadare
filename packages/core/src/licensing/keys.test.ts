import { describe, expect, it } from 'vitest'
import { generateLicenseKey, hashLicenseKey, licenseKeyHint, normalizeLicenseKey } from './keys'

describe('license keys', () => {
  it('has the documented shape and is random', () => {
    const a = generateLicenseKey()
    expect(a).toMatch(/^EDU-[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/)
    expect(generateLicenseKey()).not.toBe(a)
  })
  it('hashes case- and whitespace-insensitively, like the SQL function', () => {
    expect(hashLicenseKey(' edu-abcd ').equals(hashLicenseKey('EDU-ABCD'))).toBe(true)
    expect(hashLicenseKey('EDU-ABCD')).toHaveLength(32)
  })
  it('builds a support hint that does not reveal the key', () => {
    expect(licenseKeyHint('EDU-9F2A-1111-2222-7Q1M')).toBe('EDU-9F2A…7Q1M')
    expect(normalizeLicenseKey(' x ')).toBe('X')
  })
})
