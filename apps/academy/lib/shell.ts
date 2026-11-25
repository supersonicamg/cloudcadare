import { isEnabled } from '@educore/features'
import type { NavItem, ViewerInfo } from '@educore/ui/theme'
import { requireTenantBundle, getCurrentYear } from '@/lib/tenant'
import { getTheme } from '@/lib/theme'
import { brandInfo } from '@/lib/brand'
import { platformName } from '@/lib/env'
import { getAccess, getViewer, holds } from '@/lib/dal'
import { auroraHome, auroraNav, auroraSite } from '@/lib/aurora-content'
import { getLeadCourseSlug } from '@/lib/learn'

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?'

/**
 * Everything a public page needs to wrap itself in the academy's theme. `home`: the home page keeps the marketing links
 * for a signed-in person and offers "Dashboard" beside their account button (plan/16 §12).
 */
export async function getShell(opts: { home?: boolean } = {}) {
  const bundle = await requireTenantBundle()
  const theme = getTheme(bundle.branding.themeKey)
  const brand = brandInfo(bundle.branding, platformName(), await getCurrentYear())
  const aurora = bundle.branding.themeKey === 'aurora'
  const f = bundle.features
  const viewer = await getViewer()
  // A signed-in user who is not a member of THIS academy sees the signed-out header (their session belongs to another academy).
  const access = viewer.signedIn ? await getAccess() : null

  // Aurora's signed-out links point at sections of the home page, so they do not depend on the catalog feature.
  let nav: NavItem[] = aurora
    ? auroraNav
    : isEnabled(f, 'catalog.courses') ? [{ label: 'Courses', href: '/courses' }] : []
  let account: { label: string; href: string; viewer?: ViewerInfo } = { label: aurora ? 'Log in' : 'Sign in', href: '/login' }

  if (access) {
    // Signed in (plan/16 §7, §12): the learner's own links in the bar, everything about the person in the account menu.
    // Course material and Live classes belong to a course, so they appear once the learner has one.
    const slug = await getLeadCourseSlug(access)
    const learner: NavItem[] = [
      { label: 'Dashboard', href: '/dashboard' },
      ...(slug
        ? [{ label: 'Course material', href: `/learn/${slug}/material` }, { label: 'Live classes', href: `/learn/${slug}/live` }, ...(isEnabled(f, 'learning.notes') ? [{ label: 'My notes', href: '/learn/notes' }] : [])]
        : isEnabled(f, 'catalog.courses') ? [{ label: 'Program', href: '/courses' }] : []),
    ]
    if (!opts.home) nav = learner
    const name = access.memberName || viewer.fullName || viewer.email || 'You'
    account = {
      label: 'Dashboard',
      href: '/dashboard',
      viewer: {
        ...(opts.home ? { homeButton: { label: 'Dashboard', href: '/dashboard' } } : {}),
        name,
        email: viewer.email,
        initials: initialsOf(name),
        menu: [
          { label: 'Profile', href: '/account' },
          { label: 'Subscription', href: '/account/subscription' },
          ...(isEnabled(f, 'engage.gamification') ? [{ label: 'My progress', href: '/progress' }] : []),
          ...(isEnabled(f, 'learning.certificates') ? [{ label: 'Certificates', href: '/certificates' }] : []),
          ...(isEnabled(f, 'commerce.checkout') ? [{ label: 'Payments and receipts', href: '/account/payments' }] : []),
          { label: 'Password and devices', href: '/account/security' },
          ...(holds(access, 'member.view') ? [{ label: 'Admin panel', href: '/admin' }] : []),
        ],
        logoutHref: '/logout',
      },
    }
  }

  // Stand-in for CMS blocks: the aurora theme gets its copy from lib/aurora-content.ts
  const site = aurora ? auroraSite : undefined
  const home = aurora ? auroraHome : undefined
  return { bundle, theme, brand, nav, account, site, home }
}

export const TERMS = { course: 'Course', courses: 'Courses' }
