import { isEnabled } from '@educore/features'
import { getAccess } from '@/lib/dal'
import { getShell } from '@/lib/shell'
import { LearnerShell } from '../_components/learner-shell'
import { AccountRail } from './rail'
import './account.css'

export const metadata = { title: { default: 'Account', template: '%s · Account' } }

/*
 * Account area (profile, subscription, payments, password) inside the learner frame: the side list on the left, the page
 * on the right (mockup .acc). Each page brings its own h1. Log out lives in the account menu.
 * Signed out: the pages redirect to the login themselves, so there is nothing to frame.
 */
export default async function AccountLayout({ children }: LayoutProps<'/[tenant]/account'>) {
  const [shell, a] = await Promise.all([getShell(), getAccess()])
  if (!a) return <>{children}</>
  const items = [
    { href: '/account', label: 'Profile', icon: 'user' as const },
    { href: '/account/subscription', label: 'Subscription', icon: 'pass' as const },
    ...(isEnabled(shell.bundle.features, 'commerce.checkout') ? [{ href: '/account/payments', label: 'Payments and receipts', icon: 'receipt' as const }] : []),
    { href: '/account/security', label: 'Password and devices', icon: 'key' as const },
  ]
  return (
    <LearnerShell a={a} shell={shell} active={null}>
      <div className="pg">
        <div className="acc">
          <AccountRail items={items} />
          <div className="acc-main">{children}</div>
        </div>
      </div>
    </LearnerShell>
  )
}
