import { defaultTheme } from '@educore/theme-default'
import type { ThemeContract } from '@educore/ui/theme'
import { AuthLayout, FocusLayout, SiteLayout } from './layout'
import { CoursePage } from './course'
import { HomePage } from './home'

// CloudCadre's theme: warm off-white, deep teal, one yellow accent, Schibsted Grotesk.
// It restyles the shell (announcement bar, header, footer, WhatsApp button, sign-in) the home page and the course page.
// The catalog page falls back to the default theme, which reads the same colour tokens and, inside this shell,
// the same font.
export const auroraTheme: ThemeContract = { ...defaultTheme, key: 'aurora', SiteLayout, AuthLayout, FocusLayout, HomePage, CoursePage }
export default auroraTheme
