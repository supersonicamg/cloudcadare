import Link from 'next/link'
import { Icon } from '@educore/ui/marks'
import { getShell } from '@/lib/shell'
import { buttonLg, h1s, lead } from '@/lib/ui'

export const metadata = { title: 'Logged out' }

/*
 * C6 · Logged out.
 * 1. One job: confirm the session ended and offer the way back in.
 * 2. One main action: "Log in" (the only filled button; the home link is plain text).
 * 3. Reading order: tick + title (outcome first) -> one line about what is saved -> Log in -> Back to the home page.
 * Signed-out chrome, so the header shows Log in and the marketing links.
 */
export default async function LoggedOut() {
  const { theme, brand, nav, account, site } = await getShell()
  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <section aria-labelledby="lo-h" className="mx-auto flex max-w-[560px] flex-col items-start gap-6 px-5 pb-24 pt-14 md:pt-24">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-[#E4EFEB] text-primary"><Icon name="check" className="h-7 w-7" /></span>
        <div className="flex flex-col gap-3">
          <h1 id="lo-h" className={h1s}>You are logged out</h1>
          <p className={lead}>Your lessons, notes and progress are saved.</p>
        </div>
        <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-center sm:gap-6">
          <Link href="/login" className={`${buttonLg} w-full sm:w-auto`}>Log in</Link>
          <Link href="/" className="inline-flex min-h-11 items-center t-btn-sm !font-bold text-primary hover:underline">Back to the home page</Link>
        </div>
      </section>
    </theme.SiteLayout>
  )
}
