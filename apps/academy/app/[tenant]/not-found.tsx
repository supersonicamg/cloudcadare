import Link from 'next/link'
import { isEnabled } from '@educore/features'
import { catalogLink } from '@/lib/catalog'
import { getShell } from '@/lib/shell'
import { buttonLg, buttonLine, h1s, lead } from '@/lib/ui'

/** Any missing page of an academy (also: a course that is not yours to open). Same shell as the rest of the site. */
export default async function NotFound() {
  const { bundle, theme, brand, nav, account, site } = await getShell()
  const catalog = isEnabled(bundle.features, 'catalog.courses') ? await catalogLink(bundle.tenant.id) : null
  const program = catalog ? { label: catalog.only ? 'See the program' : 'See all courses', href: catalog.href } : undefined
  if (theme.NotFoundPage) {
    return (
      <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
        <theme.NotFoundPage primary={program} secondary={account} />
      </theme.SiteLayout>
    )
  }
  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <section className="mx-auto max-w-[760px] px-5 pb-24 pt-14 md:pt-20">
        <p className="text-[17px] font-semibold text-primary">Page not found</p>
        <h1 className={`${h1s} mt-3`}>We could not find that page</h1>
        <p className={`${lead} mt-4 max-w-xl`}>The link may be old or mistyped, or the page may have moved. Here is where most people want to go.</p>
        <div className="mt-8 flex flex-wrap gap-3.5">
          {catalog && <Link href={catalog.href} className={buttonLg}>{catalog.only ? 'See the program' : 'See all courses'}</Link>}
          <Link href={account.href} className={buttonLine}>{account.label}</Link>
        </div>
      </section>
    </theme.SiteLayout>
  )
}
