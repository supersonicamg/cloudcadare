import { Suspense } from 'react'
import { getShell } from '@/lib/shell'

/** After "Log out" the learner lands here with a short confirmation (plan/16 §12). */
async function LoggedOutNote({ searchParams }: { searchParams: PageProps<'/[tenant]'>['searchParams'] }) {
  const sp = await searchParams
  if (sp['logged-out'] === undefined) return null
  return <p role="status" className="mx-auto mt-4 w-fit max-w-[calc(100%-32px)] rounded-2xl bg-muted px-5 py-3 t-label !text-fg">You are logged out. Your lessons, notes and progress are saved.</p>
}

export default async function HomePage(props: PageProps<'/[tenant]'>) {
  const { theme, brand, nav, account, site, home } = await getShell({ home: true })
  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <Suspense fallback={null}><LoggedOutNote searchParams={props.searchParams} /></Suspense>
      <theme.HomePage brand={brand} content={home} />
    </theme.SiteLayout>
  )
}
