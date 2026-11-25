'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { BrandInfo, NavItem, ViewerInfo } from '@educore/ui/theme'
import { A, Brand, WhatsAppIcon } from './parts'

function subscribeScroll(cb: () => void) {
  window.addEventListener('scroll', cb, { passive: true })
  return () => window.removeEventListener('scroll', cb)
}

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
        <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
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
 * Sticky header (plan/15 §7.2). Signed out: logo, section links, Log in, outline WhatsApp. Signed in (plan/16 §7):
 * logo, the learner's links, and ONE account button; WhatsApp help moves into its menu and Log out is its last item.
 * It gets a hairline shadow once the page has scrolled. On phones the links move into a Menu dropdown (who is signed
 * in first, Log out last). It is the direct child of the page shell, which is what lets it stay on screen.
 */
export function SiteHeader({ brand, nav, account, whatsapp }: { brand: BrandInfo; nav: NavItem[]; account: NavItem & { viewer?: ViewerInfo }; whatsapp: string | null }) {
  const scrolled = useSyncExternalStore(subscribeScroll, () => window.scrollY > 8, () => false)
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<string | null>(null)
  const pathname = usePathname()
  const viewer = account.viewer
  const close = () => setOpen(false)
  useEffect(() => setOpen(false), [pathname])

  // Marks the link whose section is crossing the middle of the screen (home page). Pages without such sections mark nothing.
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>('main section[id]')
    if (!sections.length) return
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setCurrent(e.target.id) }),
      { rootMargin: '-45% 0px -50% 0px' },
    )
    sections.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [])

  // Signed in: the link of the page the learner is on. Signed out: the home section on screen.
  const here = (href: string) => {
    if (viewer && !viewer.homeButton) {
      // Only the most specific link is marked: "My notes" (/learn/notes) must not light up beside a deeper link too.
      const match = (h: string) => pathname === h || (h !== '/' && pathname.startsWith(`${h}/`))
      const best = nav.filter((n) => match(n.href)).sort((x, y) => y.href.length - x.href.length)[0]
      return best?.href === href ? 'page' : undefined
    }
    return current && href.endsWith(`#${current}`) ? 'true' : undefined
  }

  return (
    <div className={`au bar${scrolled ? ' scrolled' : ''}`}>
      <header className="hdr wrap">
        <nav className="nav" aria-label="Main">
          {/* Signed in, the logo goes to the dashboard; the home page is still at "/" for anyone who types it. */}
          <Brand brand={brand} href={viewer ? account.href : undefined} />
          <div className="links">{nav.map((n) => <A key={n.href + n.label} href={n.href} aria-current={here(n.href)}>{n.label}</A>)}</div>
          <div className="nav-end">
            {viewer ? (
              <>
                {viewer.homeButton && <A href={viewer.homeButton.href} className="btn btn-sm btn-line">{viewer.homeButton.label}</A>}
                <AccountMenu viewer={viewer} whatsapp={whatsapp} />
              </>
            ) : (
              <>
                <A href={account.href}>{account.label}</A>
                {whatsapp && <a className="btn btn-sm btn-line" href={whatsapp} target="_blank" rel="noopener noreferrer"><WhatsAppIcon />WhatsApp us</a>}
              </>
            )}
          </div>
          <button type="button" className="menu" aria-expanded={open} aria-controls="au-mnav" onClick={() => setOpen((o) => !o)}>
            {open ? 'Close' : 'Menu'}
          </button>
        </nav>
        <div id="au-mnav" className="mnav" hidden={!open}>
          {viewer && <div className="who"><Avatar initials={viewer.initials} /><div><b>{viewer.name}</b>{viewer.email && <span>{viewer.email}</span>}</div></div>}
          {viewer?.homeButton && <A href={viewer.homeButton.href} onClick={close}>{viewer.homeButton.label}</A>}
          {nav.map((n) => <A key={n.href + n.label} href={n.href} aria-current={here(n.href)} onClick={close}>{n.label}</A>)}
          {viewer ? (
            <>
              {viewer.menu.map((m) => <A key={m.href} href={m.href} className="sub" onClick={close}>{m.label}</A>)}
              {whatsapp && <a className="sub" href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={close}>Help on WhatsApp</a>}
              <LogOut href={viewer.logoutHref} onClick={close} />
            </>
          ) : (
            <>
              <A href={account.href} onClick={close}>{account.label}</A>
              {whatsapp && <a className="btn btn-line" href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={close}><WhatsAppIcon />WhatsApp us</a>}
            </>
          )}
        </div>
      </header>
    </div>
  )
}
