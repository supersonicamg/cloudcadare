'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Icon, type IconName } from '@educore/ui/marks'

/** `match` lists every page of the place; `badge` is a count that needs attention. */
export type NavItem = { href: string; label: string; icon: IconName; match?: string[]; badge?: number }

const under = (path: string, href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`))

/** A list beside the page on wide screens, a menu button on narrow ones. Shows where you are. */
export function AdminNav({ items, brand, who }: { items: NavItem[]; brand: string; who: string }) {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const current = items.find((i) => (i.match ?? [i.href]).some((href) => under(path, href)))

  const links = (
    <ul className="grid gap-1">
      {items.map((i) => {
        const on = i === current
        return (
          <li key={i.label}>
            <Link href={i.href} onClick={() => setOpen(false)} aria-current={on ? 'page' : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-3.5 text-[16px] font-semibold ${on ? 'bg-primary text-primary-fg' : 'text-fg hover:bg-muted'}`}>
              <Icon name={i.icon} className={`h-[22px] w-[22px] shrink-0 ${on ? '' : 'text-primary'}`} />
              <span className="min-w-0 flex-1">{i.label}</span>
              {i.badge ? (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-accent px-2 py-0.5 text-[13px] font-bold tabular-nums text-fg">
                  {i.badge > 99 ? '99+' : i.badge}<span className="sr-only"> waiting</span>
                </span>
              ) : null}
            </Link>
          </li>
        )
      })}
    </ul>
  )
  const site = (
    <Link href="/" className="flex min-h-12 items-center gap-3 rounded-xl px-3.5 text-[15px] font-semibold text-primary hover:bg-muted">
      <Icon name="link" className="h-5 w-5" /> Open my website
    </Link>
  )

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-border bg-white lg:hidden">
        <div className="flex h-16 items-center justify-between gap-3 px-4">
          <span className="min-w-0 truncate text-lg font-bold tracking-tight">{brand}</span>
          <button type="button" aria-expanded={open} aria-controls="admin-menu" onClick={() => setOpen((v) => !v)}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[10px] border-2 border-fg px-4 text-[15px] font-semibold">
            {open ? 'Close' : 'Menu'}
          </button>
        </div>
        {open && (
          <nav id="admin-menu" aria-label="Admin" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-border px-3 py-3">
            {links}
            <div className="mt-3 border-t border-border pt-3">{site}</div>
          </nav>
        )}
      </div>

      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col overflow-y-auto border-r border-border bg-white px-4 py-6 lg:flex">
        <Link href="/admin" className="mb-6 block px-3.5 text-[22px] font-extrabold leading-tight tracking-tight">
          {brand}<span className="block text-sm font-medium text-mute">Admin</span>
        </Link>
        <nav aria-label="Admin">{links}</nav>
        <div className="mt-auto border-t border-border pt-4">
          <p className="px-3.5 pb-1 text-sm text-mute">Signed in as <span className="font-semibold text-fg">{who}</span></p>
          {site}
        </div>
      </aside>
    </>
  )
}
