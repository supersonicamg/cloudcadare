'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { BrandInfo, NavItem, ViewerInfo } from '@educore/ui/theme'
import { A, Brand, WhatsAppIcon } from './parts'

const Avatar = ({ initials }: { initials: string }) => <span className="av" aria-hidden="true">{initials}</span>

/** Log out is a plain form POST (works without JavaScript) and ends this device's session only. */
const LogOut = ({ href, onClick }: { href: string; onClick?: () => void }) => (
  <form action={href} method="post" className="lo">
    <button type="submit" onClick={onClick}>
      <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M15 8l4 4-4 4M19 12H9" /></svg>
      Log out
    </button>
  </form>
)

/**
 * Account menu (desktop). A disclosure, not an ARIA menu: it holds links and one form button, so Tab moves through
 * it like any list. Closes on Escape (focus returns to the button), on a click outside and on navigation.
 */
function AccountMenu({ viewer, whatsapp }: { viewer: ViewerInfo; whatsapp: string | null }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus() } }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  const first = viewer.name.split(' ')[0]
  return (
    <div className="acct" ref={root}>
      <button ref={button} type="button" className="acct-btn" aria-expanded={open} aria-controls="au-acct" onClick={() => setOpen((o) => !o)}>
        <Avatar initials={viewer.initials} />
        <span className="acct-name">{first}</span>
        <span className="sr">Account menu</span>
      </button>
      <div id="au-acct" className="acct-panel" hidden={!open}>
        <div className="acct-who"><b>{viewer.name}</b>{viewer.email && <span>{viewer.email}</span>}</div>
        <ul>
          {viewer.menu.map((m) => <li key={m.href}><A href={m.href} aria-current={pathname === m.href ? 'page' : undefined}>{m.label}</A></li>)}
        </ul>
        <div className="acct-sep" />
        <ul>
          {whatsapp && <li><a href={whatsapp} target="_blank" rel="noopener noreferrer"><WhatsAppIcon />Help on WhatsApp</a></li>}
          <li><LogOut href={viewer.logoutHref} /></li>
        </ul>
      </div>
    </div>
  )
}

/**
 * Header (plan/15 §10.2). Dark and sticky, 64px (56px on phones). Signed out: logo, four section links, Log in, outline
 * "WhatsApp us". Signed in (plan/16 §7): logo, the learner's links, and ONE account button; WhatsApp help moves into its
 * menu and Log out is its last item. Up to 900px the links move to a visible row of equal tabs under the header (never a
 * hamburger, plan/15 §8); that row scrolls away and only the header row stays. "Log in" stays in the header row on phones:
 * a learner must be able to sign in from any width. The header is a direct child of the page shell, which is what lets
 * it stay on screen.
 */
export function SiteHeader({ brand, nav, account, whatsapp }: { brand: BrandInfo; nav: NavItem[]; account: NavItem & { viewer?: ViewerInfo }; whatsapp: string | null }) {
  const pathname = usePathname()
  const viewer = account.viewer

  // Signed in: the link of the page the learner is on, marked for screen readers and drawn with an underline.
  const here = (href: string) => {
    if (!viewer || viewer.homeButton) return undefined
    // Only the most specific link is marked: "My notes" (/learn/notes) must not light up beside a deeper link too.
    const match = (h: string) => pathname === h || (h !== '/' && pathname.startsWith(`${h}/`))
    const best = nav.filter((n) => match(n.href)).sort((x, y) => y.href.length - x.href.length)[0]
    return best?.href === href ? 'page' : undefined
  }

  return (
    <>
      <div className="cc hd-bar">
        <header className="hd">
          <div className="wrap hd-in">
            {/* Signed in, the logo goes to the dashboard; the home page is still at "/" for anyone who types it. */}
            <Brand brand={brand} href={viewer ? account.href : undefined} />
            <nav className="nav" aria-label="Main">
              {nav.map((n) => <A key={n.href + n.label} href={n.href} aria-current={here(n.href)}>{n.label}</A>)}
            </nav>
            <div className="hd-end">
              {viewer ? (
                <>
                  {viewer.homeButton && <A href={viewer.homeButton.href} className="hd-wa">{viewer.homeButton.label}</A>}
                  <AccountMenu viewer={viewer} whatsapp={whatsapp} />
                </>
              ) : (
                <>
                  <A className="login" href={account.href}>{account.label}</A>
                  {whatsapp && <a className="hd-wa" href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Message us on WhatsApp"><WhatsAppIcon /><span>WhatsApp us</span></a>}
                </>
              )}
            </div>
          </div>
        </header>
      </div>
      <div className="cc sn-wrap">
        <nav className="subnav" aria-label="Main, short">
          <ul style={{ '--n': nav.length } as CSSProperties}>
            {nav.map((n) => <li key={n.href + n.label}><A href={n.href} aria-current={here(n.href)}>{n.shortLabel ?? n.label}</A></li>)}
          </ul>
        </nav>
      </div>
    </>
  )
}
