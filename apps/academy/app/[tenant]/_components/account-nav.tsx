import Link from 'next/link'
import { isEnabled } from '@educore/features'
import type { TenantBundle } from '@educore/tenancy'

/** The learner's own area: where to go from "My learning". Items appear only when the academy has that module on. */
export function AccountNav({ bundle, active }: { bundle: TenantBundle; active: 'learning' | 'progress' | 'certificates' | 'orders' }) {
  const f = bundle.features
  const items = [
    { key: 'learning', href: '/learn', label: 'My learning', show: true },
    { key: 'progress', href: '/progress', label: 'My progress', show: isEnabled(f, 'engage.gamification') },
    { key: 'certificates', href: '/certificates', label: 'Certificates', show: isEnabled(f, 'learning.certificates') },
    { key: 'orders', href: '/orders', label: 'My orders', show: isEnabled(f, 'commerce.checkout') },
  ].filter((i) => i.show)
  if (items.length < 2) return null
  return (
    <nav aria-label="My account" className="mb-[34px] flex flex-wrap gap-x-7 gap-y-1 border-b border-border text-base font-semibold">
      {items.map((i) => (
        <Link key={i.key} href={i.href} aria-current={i.key === active ? 'page' : undefined}
          className={`py-3 ${i.key === active ? 'text-fg shadow-[0_3px_0_var(--color-accent)]' : 'text-mute hover:text-fg'}`}>{i.label}</Link>
      ))}
    </nav>
  )
}
