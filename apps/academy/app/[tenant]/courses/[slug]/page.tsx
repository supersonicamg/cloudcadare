import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isEnabled } from '@educore/features'
import type { CourseCta, SectionDto } from '@educore/ui/theme'
import { cachedCourse, catalogLink } from '@/lib/catalog'
import { getAccess } from '@/lib/dal'
import { getMyEnrollments } from '@/lib/learn'
import { getShell, TERMS } from '@/lib/shell'
import { requireTenantBundle } from '@/lib/tenant'
import { startCheckout } from '../../checkout/actions'
import { enrolInCourse } from '../../learn/actions'
import { money } from '@/lib/money'

export async function generateMetadata({ params }: PageProps<'/[tenant]/courses/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const bundle = await requireTenantBundle()
  const course = await cachedCourse(bundle.tenant.id, slug)
  return course ? { title: course.title, description: course.summary ?? course.subtitle ?? undefined } : {}
}

/** Free-preview lessons get a link to their public preview page. */
const withPreviewLinks = (sections: SectionDto[], slug: string): SectionDto[] => sections.map((s) => ({
  ...s,
  lessons: s.lessons.map((l) => (l.isPreview ? { ...l, previewHref: `/courses/${slug}/preview/${l.id}` } : l)),
  children: withPreviewLinks(s.children, slug),
}))

export default async function CoursePage({ params }: PageProps<'/[tenant]/courses/[slug]'>) {
  const { slug } = await params
  const { bundle, theme, brand, nav, account, site } = await getShell()
  if (!isEnabled(bundle.features, 'catalog.courses')) notFound()
  const course = await cachedCourse(bundle.tenant.id, slug)
  if (!course) notFound()

  const catalog = await catalogLink(bundle.tenant.id)

  // The course itself is shared and cached; only this call line depends on who is looking.
  const login = `/login?next=${encodeURIComponent(`/courses/${slug}`)}`
  const access = await getAccess()
  const enrolled = access ? (await getMyEnrollments(access)).some((e) => e.course.id === course.id) : false
  let cta: CourseCta
  if (enrolled) cta = { label: 'Continue learning', href: `/learn/${slug}` }
  else if (course.offer) {
    cta = access
      ? { label: `Buy for ${money(course.offer.amountMinor, course.offer.currency)}`, action: startCheckout.bind(null, course.offer.productId, course.offer.priceId, slug) }
      : { label: 'Sign in to buy', href: login }
  } else if (course.enrolmentOpen) {
    cta = access
      ? { label: 'Enrol for free', action: enrolInCourse.bind(null, course.id, slug) }
      : { label: `Sign in to start this ${TERMS.course.toLowerCase()}`, href: login }
  } else {
    // Paid enrolment arrives with checkout. Until then a course that is not open cannot be joined.
    cta = { label: 'Enrolment opens soon', note: 'This course is not open for enrolment yet.' }
  }

  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <theme.CoursePage brand={brand} site={site} course={{ ...course, sections: withPreviewLinks(course.sections, slug) }} cta={cta} terms={TERMS} catalogHref={catalog.only === slug ? undefined : '/courses'} />
    </theme.SiteLayout>
  )
}
