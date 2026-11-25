import { describe, expect, it } from 'vitest'
import { normalizeHost, parseHost } from './host'

const base = 'educore.app'
describe('parseHost', () => {
  it('normalizes port, case and trailing dot', () => {
    expect(normalizeHost('Demo.EduCore.app:3000')).toBe('demo.educore.app')
    expect(normalizeHost('demo.educore.app.')).toBe('demo.educore.app')
  })
  it('detects academies on the platform subdomain', () => {
    expect(parseHost('demo.educore.app', base)).toEqual({ kind: 'tenant_subdomain', slug: 'demo', hostname: 'demo.educore.app' })
  })
  it('detects platform apps', () => {
    expect(parseHost('console.educore.app', base)).toMatchObject({ kind: 'platform_app', app: 'console' })
    expect(parseHost('start.educore.app', base)).toMatchObject({ kind: 'platform_app', app: 'start' })
  })
  it('treats the bare base domain as marketing', () => {
    expect(parseHost('educore.app', base).kind).toBe('marketing')
  })
  it('treats foreign hosts as custom domains', () => {
    expect(parseHost('learn.cloudcadre.in', base)).toEqual({ kind: 'custom', hostname: 'learn.cloudcadre.in' })
  })
  it('does not let a look-alike suffix pass as a subdomain', () => {
    expect(parseHost('evil-educore.app', base).kind).toBe('custom')
    expect(parseHost('a.b.educore.app', base).kind).toBe('invalid')
  })
  it('rejects garbage', () => {
    expect(parseHost('', base).kind).toBe('invalid')
    expect(parseHost('exa mple.com', base).kind).toBe('invalid')
  })
  it('works with localhost for development', () => {
    expect(parseHost('demo.localhost:3000', 'localhost')).toMatchObject({ kind: 'tenant_subdomain', slug: 'demo' })
  })
})
