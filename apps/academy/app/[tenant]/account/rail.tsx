'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Section links of the account area. Desktop: a quiet vertical list; the current page is bold ink with a teal bar
 * (no filled block, so the page title stays the loudest thing). Phone: a two-column grid of 44px links.
 * Log out repeats the account menu's last item, after a rule, as plain text in a form POST.
 */
export function AccountRail({ items, logoutHref }: { items: Array<{ href: string; label: string }>; logoutHref: string }) {
  const path = usePathname()
  return (
    <nav aria-label="Account sections" className="md:sticky md:top-28 md:self-start">
      <p className="t-label mb-3 hidden !text-mute md:block">Account</p>
      <ul className="grid grid-cols-2 gap-2 md:grid-cols-1 md:gap-0">
        {items.map((i) => {
          const here = path === i.href
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={here ? 'page' : undefined}
                className={`flex min-h-11 items-center rounded-xl border px-3.5 t-label md:rounded-none md:border-0 md:border-l-[3px] md:py-1.5 md:pl-4 ${here
                  ? 'border-fg !text-fg font-bold md:border-primary'
                  : 'border-border hover:!text-fg md:border-transparent md:hover:border-border'}`}>
                {i.label}
              </Link>
            </li>
          )
        })}
      </ul>
      <form action={logoutHref} method="post" className="mt-3 border-t border-border pt-3 md:mt-4 md:pt-4">
        <button type="submit" className="flex min-h-11 w-full items-center rounded-xl px-3.5 t-label hover:!text-fg md:pl-[19px]">Log out</button>
      </form>
    </nav>
  )
}
