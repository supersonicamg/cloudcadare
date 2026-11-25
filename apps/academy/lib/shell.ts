import { isEnabled } from '@educore/features'
import { requireTenantBundle, getCurrentYear } from '@/lib/tenant'
import { getTheme } from '@/lib/theme'
import { brandInfo } from '@/lib/brand'
import { platformName } from '@/lib/env'
import { getViewer } from '@/lib/dal'
import { auroraHome, auroraNav, auroraSite } from '@/lib/aurora-content'

/** Everything a public page needs to wrap itself in the academy's theme. */
export async function getShell() {
  const bundle = await requireTenantBundle()
  const theme = getTheme(bundle.branding.themeKey)
  const brand = brandInfo(bundle.branding, platformName(), await getCurrentYear())
  const aurora = bundle.branding.themeKey === 'aurora'
  // Aurora's links point at sections of the home page, so they do not depend on the catalog feature.
  const nav = aurora
    ? auroraNav
    : isEnabled(bundle.features, 'catalog.courses') ? [{ label: 'Courses', href: '/courses' }] : []
  const { signedIn } = await getViewer()
  const account = signedIn ? { label: 'My learning', href: '/learn' } : { label: aurora ? 'Log in' : 'Sign in', href: '/login' }
  // Stand-in for CMS blocks: the aurora theme gets its copy from lib/aurora-content.ts
  const site = aurora ? auroraSite : undefined
  const home = aurora ? auroraHome : undefined
  return { bundle, theme, brand, nav, account, site, home }
}

export const TERMS = { course: 'Course', courses: 'Courses' }
