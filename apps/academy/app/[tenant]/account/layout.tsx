import { isEnabled } from '@educore/features'
import { getAccess } from '@/lib/dal'
import { getShell } from '@/lib/shell'
import { LearnerShell } from '../_components/learner-shell'
import { AccountRail } from './rail'

export const metadata = { title: { default: 'Account', template: '%s · Account' } }

/*
 * Account area (profile, subscription, payments, password) inside the learner frame. Each page brings its own h1; the
 * sections are a row of chips above it, like the filters on Lessons and Notes. Log out lives in the account menu.
 * Signed out: the pages redirect to the login themselves, so there is nothing to frame.
 */
export default async function AccountLayout({ children }: LayoutProps<'/[tenant]/account'>) {
  const [shell, a] = await Promise.all([getShell(), getAccess()])
  if (!a) return <>{children}</>
  const items = [
    { href: '/account', label: 'Profile' },
    { href: '/account/subscription', label: 'Subscription' },
    ...(isEnabled(shell.bundle.features, 'commerce.checkout') ? [{ href: '/account/payments', label: 'Payments and receipts' }] : []),
    { href: '/account/security', label: 'Password and devices' },
  ]
  return (
    <LearnerShell a={a} shell={shell} active={null}>
      <AccountRail items={items} />
      <div className="min-w-0">{children}</div>
    </LearnerShell>
  )
}
