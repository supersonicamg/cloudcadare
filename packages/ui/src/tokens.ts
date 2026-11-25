import { z } from 'zod'

// L1 design tokens (plan/05 §3). Every value is validated against a strict pattern
// because it ends up inside a <style> tag: this is what keeps tenant branding from
// becoming a CSS/HTML injection vector.
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour like #0F5C56')
const length = z.string().regex(/^\d+(\.\d+)?(rem|px)$/, 'Use rem or px, e.g. 0.75rem')
const fontName = z.string().regex(/^[A-Za-z0-9 ]{1,40}$/, 'Letters, numbers and spaces only')

const colors = z.object({
  primary: hex, primaryFg: hex, accent: hex, bg: hex, fg: hex, muted: hex, border: hex,
  success: hex, warning: hex, danger: hex,
})

export const tokensSchema = z.object({
  mode: z.enum(['light', 'dark', 'system']).default('light'),
  colors: colors.partial().default({}),
  dark: colors.partial().default({}),
  radius: length.default('0.5rem'),
  font: z.object({
    heading: fontName.optional(),
    body: fontName.optional(),
  }).default({}),
  density: z.enum(['compact', 'comfortable']).default('comfortable'),
})

export type TokensInput = z.input<typeof tokensSchema>
export type Tokens = z.output<typeof tokensSchema>
type ColorKey = keyof z.infer<typeof colors>

export const DEFAULT_COLORS: Record<ColorKey, string> = {
  primary: '#0F5C56', primaryFg: '#FFFFFF', accent: '#F2B705',
  bg: '#FBFAF7', fg: '#14201F', muted: '#F0EEE8', border: '#DDD9CF',
  success: '#12805C', warning: '#B26A00', danger: '#C23B2E',
}
export const DEFAULT_DARK: Partial<Record<ColorKey, string>> = {
  bg: '#0E1514', fg: '#E8EEEC', muted: '#162120', border: '#26332F',
}

// ---- contrast (WCAG 2.x)
function luminance(hexColor: string): number {
  const n = parseInt(hexColor.slice(1), 16)
  const lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}
/** Black or white, whichever reads better on `bgColor`. */
export function readableForeground(bgColor: string): '#000000' | '#FFFFFF' {
  return contrastRatio(bgColor, '#FFFFFF') >= contrastRatio(bgColor, '#000000') ? '#FFFFFF' : '#000000'
}

const VAR: Record<ColorKey, string> = {
  primary: '--color-primary', primaryFg: '--color-primary-fg', accent: '--color-accent',
  bg: '--color-bg', fg: '--color-fg', muted: '--color-muted', border: '--color-border',
  success: '--color-success', warning: '--color-warning', danger: '--color-danger',
}

function decls(colorSet: Partial<Record<ColorKey, string>>): string {
  return (Object.keys(colorSet) as ColorKey[]).map((k) => `${VAR[k]}:${colorSet[k]};`).join('')
}

/** Parses untrusted JSON from tenant_branding.tokens. Falls back to defaults on any error. */
export function parseTokens(raw: unknown): Tokens {
  const r = tokensSchema.safeParse(raw ?? {})
  return r.success ? r.data : tokensSchema.parse({})
}

/** Returns the text of a <style> element. Safe because every value is pattern-validated. */
export function tokensToCss(raw: unknown): string {
  const t = parseTokens(raw)
  const light = { ...DEFAULT_COLORS, ...t.colors }
  // never trust a stored primaryFg that fails contrast: derive it
  if (contrastRatio(light.primary, light.primaryFg) < 4.5) light.primaryFg = readableForeground(light.primary)
  const dark = { ...light, ...DEFAULT_DARK, ...t.dark }
  const font = [
    t.font.heading ? `--font-heading:"${t.font.heading}",var(--font-fallback);` : '',
    t.font.body ? `--font-body:"${t.font.body}",var(--font-fallback);` : '',
  ].join('')
  const base = `:root{${decls(light)}--radius:${t.radius};${font}color-scheme:light;}`
  const darkCss = `{${decls(dark)}color-scheme:dark;}`
  const darkBlock =
    t.mode === 'dark' ? `:root${darkCss}`
    : t.mode === 'system' ? `@media (prefers-color-scheme:dark){:root${darkCss}}`
    : ''
  return base + darkBlock
}
