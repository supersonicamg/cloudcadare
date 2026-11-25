'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/', label: 'Overview' },
  { href: '/tenants', label: 'Academies' },
  { href: '/licenses', label: 'License keys' },
] as const

export function NavLinks() {
  const path = usePathname()
  const active = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`))
  return (
    <nav className="flex flex-wrap gap-1 md:flex-col" aria-label="Console">
      {ITEMS.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={active(i.href) ? 'page' : undefined}
          className="rounded-[10px] px-3 py-2.5 text-[15px] font-medium text-white/75 hover:text-white aria-[current=page]:bg-deep aria-[current=page]:text-white aria-[current=page]:shadow-[inset_3px_0_0_var(--color-accent)]"
        >
          {i.label}
        </Link>
      ))}
    </nav>
  )
}
