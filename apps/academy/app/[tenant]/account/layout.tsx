import { isEnabled } from '@educore/features'
import { getShell } from '@/lib/shell'
import { AccountRail } from './rail'

export const metadata = { title: { default: 'Account', template: '%s · Account' } }

/*
 * Account shell (C2-C5). Each page brings its own h1 (Profile, Subscription, ...) in the right column; the left
 * column is a quiet list of sections. The dominant region of every page is its first panel or list.
 */
export default async function AccountLayout({ children }: LayoutProps<'/[tenant]/account'>) {
  const { theme, brand, nav, account, site, bundle } = await getShell()
  const items = [
    { href: '/account', label: 'Profile' },
    { href: '/account/subscription', label: 'Subscription' },
    ...(isEnabled(bundle.features, 'commerce.checkout') ? [{ href: '/account/payments', label: 'Payments and receipts' }] : []),
    { href: '/account/security', label: 'Password and devices' },
  ]
  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <div className="mx-auto grid max-w-[1280px] gap-8 px-[clamp(16px,5vw,72px)] pb-24 pt-8 md:grid-cols-[232px_minmax(0,1fr)] md:gap-14 md:pt-14">
        <AccountRail items={items} logoutHref="/logout" />
        <div className="min-w-0">{children}</div>
      </div>
    </theme.SiteLayout>
  )
}
