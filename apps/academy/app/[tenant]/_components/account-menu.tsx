'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export interface AccountMenuProps {
  name: string
  email?: string | null
  initials: string
  items: Array<{ label: string; href: string }>
  logoutHref: string
  whatsapp: string | null
  /** Where the panel opens: above the button (sidebar, bottom of the screen) or below it (top bar). */
  opens: 'up' | 'down'
}

/**
 * The person's menu: profile, payments, log out. A disclosure (links plus one form button), so Tab walks through it like a list.
 * Closes on Escape (focus returns to the button), on a click outside and on navigation. Log out is a plain form POST.
 */
export function AccountMenu({ name, email, initials, items, logoutHref, whatsapp, opens }: AccountMenuProps) {
  // Open for the page it was opened on, so any navigation closes it without an effect.
  const pathname = usePathname()
  const [openAt, setOpenAt] = useState<string | null>(null)
  const open = openAt === pathname
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpenAt(null) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpenAt(null); button.current?.focus() } }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const first = name.split(/\s+/)[0]
  return (
    <div className={`lx-acct ${opens}`} ref={root}>
      <button ref={button} type="button" className="lx-acct-btn" aria-expanded={open} aria-haspopup="true" onClick={() => setOpenAt(open ? null : pathname)}>
        <span className="lx-av" aria-hidden="true">{initials}</span>
        <span className="lx-acct-name">{first}</span>
        <svg className="lx-acct-ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <div className="lx-acct-panel">
          <p className="lx-acct-who"><b>{name}</b>{email && <span>{email}</span>}</p>
          <ul>
            {items.map((m) => <li key={m.href}><Link href={m.href}>{m.label}</Link></li>)}
            {whatsapp && <li><a href={whatsapp} target="_blank" rel="noopener noreferrer">Help on WhatsApp</a></li>}
          </ul>
          <form action={logoutHref} method="post"><button type="submit">Log out</button></form>
        </div>
      )}
    </div>
  )
}
