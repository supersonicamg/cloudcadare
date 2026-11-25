import { describe, expect, it } from 'vitest'
import { describeAuthError, normaliseWhatsapp, parseLogin, parseSignUp, safeNext } from './index'

const form = (values: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(values)) f.set(k, v)
  return f
}
const good = { name: '  Ananya Rao ', email: ' Ananya@Example.COM ', whatsapp: '98765 43210', password: 'correct horse' }

describe('normaliseWhatsapp', () => {
  it.each(['9876543210', '09876543210', '919876543210', '+91 98765-43210', '0091 98765 43210'])('reads %s as an Indian number', (raw) => {
    expect(normaliseWhatsapp(raw)).toBe('+919876543210')
  })
  it('keeps other countries when they start with +', () => {
    expect(normaliseWhatsapp('+1 (415) 555-2671')).toBe('+14155552671')
  })
  it.each(['', '12345', '5876543210', '+91 12345 67890', '4155552671', 'abcdefghij', '+9198765432101234'])('rejects %j', (raw) => {
    expect(normaliseWhatsapp(raw)).toBeNull()
  })
})

describe('safeNext', () => {
  it('keeps a path on this site', () => expect(safeNext('/courses/aws?x=1')).toBe('/courses/aws?x=1'))
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/\t/evil.example', '', undefined, null])('falls back to / for %j', (raw) => {
    expect(safeNext(raw)).toBe('/')
  })
})

describe('parseSignUp', () => {
  it('trims and normalises', () => {
    expect(parseSignUp(form(good))).toEqual({
      ok: true, data: { name: 'Ananya Rao', email: 'ananya@example.com', whatsapp: '+919876543210', password: 'correct horse' },
    })
  })
  it.each([['name', ' '], ['email', 'nope'], ['whatsapp', '123'], ['password', 'short']])('names the %s field when it is wrong', (field, value) => {
    expect(parseSignUp(form({ ...good, [field]: value }))).toMatchObject({ ok: false, field })
  })
  it('does not trim the password', () => {
    expect(parseSignUp(form({ ...good, password: '  spaced pass  ' }))).toMatchObject({ data: { password: '  spaced pass  ' } })
  })
})

describe('parseLogin', () => {
  it('accepts a short existing password', () => expect(parseLogin(form({ email: 'a@example.com', password: 'abc' })).ok).toBe(true))
  it('needs a password', () => expect(parseLogin(form({ email: 'a@example.com' }))).toMatchObject({ ok: false, field: 'password' }))
})

describe('describeAuthError', () => {
  it('does not say which of email or password was wrong', () => {
    expect(describeAuthError({ code: 'invalid_credentials', status: 400 }, 'login')).toEqual({ error: 'Wrong email or password.' })
  })
  it('explains rate limiting', () => expect(describeAuthError({ status: 429 }, 'login').error).toMatch(/Too many/))
})
