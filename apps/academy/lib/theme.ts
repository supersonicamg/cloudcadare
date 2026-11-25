import { auroraTheme } from '@educore/theme-aurora'
import { defaultTheme } from '@educore/theme-default'
import type { ThemeContract } from '@educore/ui/theme'

// Static import map: each theme is code-split and a tenant only downloads its own.
// Add themes here as they are built; unknown keys fall back to the default theme.
const themes: Record<string, () => ThemeContract> = {
  default: () => defaultTheme,
  aurora: () => auroraTheme,
}

export function getTheme(key: string): ThemeContract {
  return (themes[key] ?? themes.default!)()
}
