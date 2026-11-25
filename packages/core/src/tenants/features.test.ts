import { describe, expect, it } from 'vitest'
import { describeFeature, isUuid, moduleTitle } from './features'

const base = { isCore: false, enabled: true, source: 'plan' as const, missing: [] }

describe('describeFeature', () => {
  it('core features are always on and cannot be switched', () => {
    const c = describeFeature({ ...base, isCore: true, source: 'core' })
    expect(c).toMatchObject({ label: 'Always on', editable: false })
  })
  it('plan feature that is on', () => {
    expect(describeFeature(base)).toMatchObject({ label: 'Plan', tone: 'plain', editable: true })
  })
  it('plan lists it as off, or nothing mentions it', () => {
    expect(describeFeature({ ...base, enabled: false })).toMatchObject({ label: 'Not in plan', tone: 'quiet' })
    expect(describeFeature({ ...base, enabled: false, source: 'default' })).toMatchObject({ label: 'Not in plan' })
    expect(describeFeature({ ...base, source: 'default' })).toMatchObject({ label: 'Default' })
  })
  it('an override is flagged as a warning, whichever way it points', () => {
    expect(describeFeature({ ...base, source: 'override' })).toMatchObject({ tone: 'warn', label: 'Override for this academy' })
    expect(describeFeature({ ...base, enabled: false, source: 'override' })).toMatchObject({ tone: 'warn' })
  })
  it('a feature held back by a dependency cannot be flipped and says what is needed', () => {
    const d = describeFeature({ ...base, enabled: false, source: 'dependency', missing: ['Quizzes', 'Video'] })
    expect(d.editable).toBe(false)
    expect(d.note).toBe('Turn on Quizzes, Video first.')
  })
})

describe('helpers', () => {
  it('moduleTitle', () => {
    expect(moduleTitle('commerce')).toBe('Selling')
    expect(moduleTitle('ai')).toBe('AI')
    expect(moduleTitle('new_thing')).toBe('New thing')
  })
  it('isUuid rejects anything else', () => {
    expect(isUuid('0192b2c0-7f4e-7c3a-9d1e-3f5a6b7c8d9e')).toBe(true)
    expect(isUuid("1' or 1=1")).toBe(false)
    expect(isUuid(undefined)).toBe(false)
  })
})
