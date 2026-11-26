'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Ic, Wa, type IconName } from './v11'

export interface AccountMenuProps {
  name: string
  email?: string | null
  initials: string
  items: Array<{ label: string; href: string }>
  logoutHref: string
  whatsapp: string | null
}

const ICON: Record<string, IconName> = {
  '/account': 'user',
  '/account/subscription': 'pass',
  '/progress': 'chart',
  '/certificates': 'medal',
  '/account/payments': 'receipt',
  '/account/security': 'key',
  '/admin': 'gear',
}

/**
 * The person's menu (design guide v11): avatar and first name, a white panel with profile, subscription, progress,
 * certificates, payments, password, WhatsApp help and Log out. A disclosure (links plus one form button), so Tab walks
 * through it like a list. Closes on Escape (focus returns to the button), on a click outside and on navigation.
 * Log out is a plain form POST.
 */
export function AccountMenu({ name, email, initials, items, logoutHref, whatsapp }: AccountMenuProps) {
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
    <div className="acct" ref={root}>
      <button ref={button} type="button" className="acct-btn" aria-expanded={open} aria-haspopup="true" onClick={() => setOpenAt(open ? null : pathname)}>
        <span className="av" aria-hidden="true">{initials}</span>
        <span className="acct-name">{first}</span>
        <Ic n="down-c" s className="acct-chev" />
        <span className="sr">Account menu</span>
      </button>
      {open && (
        <div className="acct-pan">
          <p className="acct-who"><b className="t-small" style={{ fontWeight: 600, color: 'var(--ink)' }}>{name}</b>{email && <span className="t-label">{email}</span>}</p>
          {items.map((m) => <Link key={m.href} href={m.href}><Ic n={ICON[m.href] ?? 'user'} />{m.label}</Link>)}
          {whatsapp && <a className="sep" href={whatsapp} target="_blank" rel="noopener noreferrer"><Wa /> Help on WhatsApp</a>}
          <form action={logoutHref} method="post"><button type="submit" className="mi"><Ic n="out" />Log out</button></form>
        </div>
      )}
    </div>
  )
}
