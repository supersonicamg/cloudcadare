'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Ic, type IconName } from '../_components/v11'

/** The account side list (guide §10): a list on a laptop, a grid of 52px targets above the page on a tablet and phone. */
export function AccountRail({ items }: { items: Array<{ href: string; label: string; icon: IconName }> }) {
  const path = usePathname()
  return (
    <nav className="accnav" aria-label="Account">
      <p className="t-label">Account</p>
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={path === i.href ? 'page' : undefined}><Ic n={i.icon} />{i.label}</Link>
      ))}
    </nav>
  )
}
