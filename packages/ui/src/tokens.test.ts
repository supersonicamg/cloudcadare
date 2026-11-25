import { describe, expect, it } from 'vitest'
import { contrastRatio, parseTokens, tokensToCss } from './tokens'

describe('tokens', () => {
  it('emits CSS variables from defaults', () => {
    const css = tokensToCss({})
    expect(css).toContain('--color-primary:#0F5C56;')
    expect(css).toContain('--radius:0.5rem;')
  })
  it('rejects values that could break out of the stylesheet', () => {
    const t = parseTokens({ colors: { primary: 'red;} body{display:none' } })
    expect(t.colors.primary).toBeUndefined()
    expect(tokensToCss({ colors: { primary: '</style><script>' } })).not.toContain('<')
    expect(tokensToCss({ font: { heading: 'x";}</style>' } })).not.toContain('</style>')
  })
  it('derives a readable foreground when the stored one fails contrast', () => {
    const css = tokensToCss({ colors: { primary: '#FFFF00', primaryFg: '#FFFFFF' } })
    expect(css).toContain('--color-primary-fg:#000000;')
  })
  it('computes WCAG ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0)
  })
  it('emits dark mode only when asked', () => {
    expect(tokensToCss({ mode: 'light' })).not.toContain('dark')
    expect(tokensToCss({ mode: 'system' })).toContain('prefers-color-scheme:dark')
  })
})
