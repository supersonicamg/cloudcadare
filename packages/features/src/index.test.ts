import { describe, expect, it } from 'vitest'
import { getLimit, isEnabled, isWithinLimit, requireFeature, resolveFeatures } from './index'

const ent = (featureKey: string, enabled = true, limitValue: number | null = null) => ({ featureKey, enabled, limitValue })

describe('resolveFeatures', () => {
  it('keeps core features on with no entitlements at all', () => {
    const s = resolveFeatures([])
    expect(isEnabled(s, 'core.auth')).toBe(true)
  })

  it('needs both the entitlement and the module setting', () => {
    const bought = [ent('site.cms')]
    expect(isEnabled(resolveFeatures(bought), 'site.cms')).toBe(true)
    expect(isEnabled(resolveFeatures(bought, [{ featureKey: 'site.cms', isEnabled: false }]), 'site.cms')).toBe(false)
    // admin switching something on cannot create an entitlement
    expect(isEnabled(resolveFeatures([ent('site.blog', false)], [{ featureKey: 'site.blog', isEnabled: true }]), 'site.blog')).toBe(false)
  })

  it('cascades dependencies', () => {
    // site.blog depends on site.cms
    const s = resolveFeatures([ent('site.blog'), ent('site.cms', false)])
    expect(isEnabled(s, 'site.blog')).toBe(false)
  })

  it('treats unknown keys as disabled', () => {
    expect((resolveFeatures([]) as Record<string, unknown>)['nope.nothing']).toBeUndefined()
  })

  it('applies limits only when the feature is enabled, null = unlimited', () => {
    const s = resolveFeatures([ent('limit.courses', true, 20), ent('limit.staff', true, null)])
    expect(getLimit(s, 'limit.courses')).toBe(20)
    expect(isWithinLimit(s, 'limit.courses', 19)).toBe(true)
    expect(isWithinLimit(s, 'limit.courses', 20)).toBe(false)
    expect(isWithinLimit(s, 'limit.staff', 10_000)).toBe(true)
  })

  it('requireFeature throws a typed error', () => {
    expect(() => requireFeature(resolveFeatures([]), 'site.blog')).toThrowError(/not enabled/)
  })
})
