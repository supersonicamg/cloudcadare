'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

/** `badge` is a count shown beside the label (for example payments waiting to be checked). */
export type NavItem = { href: string; label: string; badge?: number }

const isActive = (path: string, href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`))

/** Sidebar on wide screens, a bar with a menu button on narrow ones. Highlights the section you are in. */
export function AdminNav({ items, brand, who, role }: { items: NavItem[]; brand: string; who: string; role: string }) {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  // The longest matching link wins, so /admin/payments/upi lights "UPI payments" and not also "Payments".
  const current = items.filter((i) => isActive(path, i.href)).sort((x, y) => y.href.length - x.href.length)[0]

  const links = (
    <ul className="grid gap-1">
      {items.map((i) => {
        const on = i === current
        return (
          <li key={i.href}>
            <Link
              href={i.href}
              onClick={() => setOpen(false)}
              aria-current={on ? 'page' : undefined}
              className={`flex items-center justify-between gap-2 rounded-xl border-l-4 px-3.5 py-2.5 text-[15px] font-semibold ${
                on ? 'border-accent bg-white/12 text-white' : 'border-transparent text-white/70 hover:bg-white/8 hover:text-white'
              }`}
            >
              {i.label}
              {i.badge ? (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-accent px-2 py-0.5 text-[13px] font-bold tabular-nums text-fg">
                  {i.badge > 99 ? '99+' : i.badge}
                  <span className="sr-only"> waiting</span>
                </span>
              ) : null}
            </Link>
          </li>
        )
      })}
    </ul>
  )

  return (
    <>
      {/* Phones and tablets */}
      <div className="sticky top-0 z-20 bg-sidebar text-white lg:hidden">
        <div className="flex h-14 items-center justify-between px-5">
          <span className="font-heading text-lg font-bold tracking-tight">{brand} <span className="font-medium text-white/60">Admin</span></span>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="admin-menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] border-2 border-white/35 px-3.5 text-[15px] font-semibold"
          >
            {open ? 'Close' : (current?.label ?? 'Menu')}
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className={open ? 'rotate-180' : ''}>
              <path d="M2 5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {open && (
          <nav id="admin-menu" aria-label="Admin" className="border-t border-white/15 px-3 pb-4 pt-3">
            {links}
            <p className="mt-4 px-3.5 text-sm text-white/65">{who} · {role}</p>
            <Link href="/" className="mt-1 block px-3.5 py-2 text-[15px] font-semibold text-accent">View site →</Link>
          </nav>
        )}
      </div>

      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar px-3.5 py-6 text-white lg:flex">
        <Link href="/admin" className="mb-8 block px-3.5 font-heading text-[22px] font-bold leading-tight tracking-tight">
          {brand}
          <span className="block text-sm font-medium text-white/60">Admin</span>
        </Link>
        <nav aria-label="Admin">{links}</nav>
        <div className="mt-auto border-t border-white/15 px-3.5 pt-4 text-sm text-white/65">
          <p className="font-semibold text-white">{who}</p>
          <p>{role}</p>
          <Link href="/" className="mt-3 inline-block font-semibold text-accent hover:underline">View site →</Link>
        </div>
      </aside>
    </>
  )
}
