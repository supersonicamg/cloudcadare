import { describe, expect, it } from 'vitest'
import { resolveFeatures } from '@educore/features'
import { can, check, requirePermission, type Principal } from './index'

const features = resolveFeatures([])
const principal = (perms: string[], aal: 'aal1' | 'aal2' = 'aal1'): Principal => ({
  permissions: new Set(perms), features, aal,
})

describe('permissions', () => {
  it('denies by default', () => {
    expect(can(principal([]), 'member.view')).toBe(false)
  })
  it('allows a granted, non-sensitive permission', () => {
    expect(can(principal(['member.view']), 'member.view')).toBe(true)
  })
  it('requires aal2 for sensitive permissions', () => {
    expect(check(principal(['member.manage']), 'member.manage')).toBe('mfa_required')
    expect(can(principal(['member.manage'], 'aal2'), 'member.manage')).toBe(true)
  })
  it('requirePermission throws', () => {
    expect(() => requirePermission(principal([]), 'member.view')).toThrowError(/denied/)
  })
})
