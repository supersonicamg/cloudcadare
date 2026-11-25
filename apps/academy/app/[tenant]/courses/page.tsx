import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isEnabled } from '@educore/features'
import { cachedCourses } from '@/lib/catalog'
import { getShell, TERMS } from '@/lib/shell'

export const metadata: Metadata = { title: 'Courses' }

export default async function CoursesPage() {
  const { bundle, theme, brand, nav, account, site } = await getShell()
  if (!isEnabled(bundle.features, 'catalog.courses')) notFound()
  const courses = await cachedCourses(bundle.tenant.id)
  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <theme.CatalogPage brand={brand} courses={courses} terms={TERMS} />
    </theme.SiteLayout>
  )
}
