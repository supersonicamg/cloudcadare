import { getShell } from '@/lib/shell'

export default async function HomePage() {
  const { theme, brand, nav, account, site, home } = await getShell()
  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <theme.HomePage brand={brand} content={home} />
    </theme.SiteLayout>
  )
}
