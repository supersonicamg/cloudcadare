'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** The sections of the account area as a row of chips (the same shape as the filters on Lessons and Notes). */
export function AccountRail({ items }: { items: Array<{ href: string; label: string }> }) {
  const path = usePathname()
  return (
    <nav aria-label="Account sections" className="lx-acc-nav">
      {items.map((i) => <Link key={i.href} href={i.href} aria-current={path === i.href ? 'page' : undefined}>{i.label}</Link>)}
    </nav>
  )
}
