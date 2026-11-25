'use client'

import { useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import type { BrandInfo, NavItem } from '@educore/ui/theme'
import { A, Brand, WhatsAppIcon } from './parts'

function subscribeScroll(cb: () => void) {
  window.addEventListener('scroll', cb, { passive: true })
  return () => window.removeEventListener('scroll', cb)
}

/**
 * Sticky header (plan/15 §7.2): logo, section links, Log in and an outline WhatsApp button. It gets a hairline shadow
 * once the page has scrolled, and the link for the section on screen gets a yellow underline. On phones the links
 * move into a Menu dropdown. It is the direct child of the page shell, which is what lets it stay on screen.
 */
export function SiteHeader({ brand, nav, account, whatsapp }: { brand: BrandInfo; nav: NavItem[]; account: NavItem; whatsapp: string | null }) {
  const scrolled = useSyncExternalStore(subscribeScroll, () => window.scrollY > 8, () => false)
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<string | null>(null)
  const close = () => setOpen(false)

  // Mark the link whose section is crossing the middle of the screen. Pages without such sections mark nothing.
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

  const here = (href: string) => (current && href.endsWith(`#${current}`) ? 'true' : undefined)

  return (
    <div className={`au bar${scrolled ? ' scrolled' : ''}`}>
      <header className="hdr wrap">
        <nav className="nav" aria-label="Main">
          <Brand brand={brand} />
          <div className="links">{nav.map((n) => <A key={n.href + n.label} href={n.href} aria-current={here(n.href)}>{n.label}</A>)}</div>
          <div className="nav-end">
            <A href={account.href}>{account.label}</A>
            {whatsapp && <a className="btn btn-sm btn-line" href={whatsapp} target="_blank" rel="noopener noreferrer"><WhatsAppIcon />WhatsApp us</a>}
          </div>
          <button type="button" className="menu" aria-expanded={open} aria-controls="au-mnav" onClick={() => setOpen((o) => !o)}>
            {open ? 'Close' : 'Menu'}
          </button>
        </nav>
        <div id="au-mnav" className="mnav" hidden={!open}>
          {nav.map((n) => <A key={n.href + n.label} href={n.href} onClick={close}>{n.label}</A>)}
          <A href={account.href} onClick={close}>{account.label}</A>
          {whatsapp && <a className="btn btn-line" href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={close}><WhatsAppIcon />WhatsApp us</a>}
        </div>
      </header>
    </div>
  )
}

// True once the hero has scrolled out of view (pages without a hero: after the first screen).
const pastHero = () => {
  const hero = document.getElementById('hero')
  return hero ? hero.getBoundingClientRect().bottom < 0 : window.scrollY > 700
}

/** Phones only (the desktop header already has WhatsApp): a green pill that follows the page once the hero is gone. */
export function WhatsAppFab({ href }: { href: string }) {
  const on = useSyncExternalStore(subscribeScroll, pastHero, () => false)
  return (
    <div className={`au-fab-wrap${on ? ' on' : ''}`}>
      <div className="au" style={{ background: 'none' }}>
        <a className="fab" href={href} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp" tabIndex={on ? 0 : -1}>
          <WhatsAppIcon /><span>Chat with us</span>
        </a>
      </div>
    </div>
  )
}

/**
 * Section reveal (plan/15 §12): fade in and rise 16px, once, when 8% from the bottom edge is crossed.
 * The classes are added from here, never in the markup, so the page is fully visible without JavaScript;
 * anything already on screen is left alone so nothing blinks on load. Off under reduced motion.
 */
export function Reveal() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }),
      { rootMargin: '0px 0px -8% 0px' },
    )
    const els = [...document.querySelectorAll<HTMLElement>('[data-reveal]')].filter((el) => el.getBoundingClientRect().top > innerHeight * 0.92)
    els.forEach((el) => { el.classList.add('rv'); io.observe(el) })
    return () => { io.disconnect(); els.forEach((el) => el.classList.remove('rv', 'in')) }
  }, [])
  return null
}

function subscribeMotion(cb: () => void) {
  const m = matchMedia('(prefers-reduced-motion: reduce)')
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}

/**
 * Lanes of cards that drift slowly past in opposite directions: many real faces on screen at once, as proof that
 * people like the visitor were hired (plan/15 §7.10). Each lane is drawn twice and slides half its width, so the loop has
 * no seam. Everything stops while the pointer or keyboard focus is on it, and a visible Pause button stops it for good
 * (moving content must be stoppable). With reduced motion nothing moves: the lanes become plain rows to swipe or scroll
 * by hand, and the second copy is not rendered.
 */
export function StoryMarquee({ lanes, label }: { lanes: ReactNode[][]; label: string }) {
  const [paused, setPaused] = useState(false)
  const still = useSyncExternalStore(subscribeMotion, () => matchMedia('(prefers-reduced-motion: reduce)').matches, () => false)
  return (
    <>
      <div className="mq-lanes" role="region" aria-label={label}>
        {lanes.map((items, i) => (
          <div key={i} className={`mq${paused ? ' paused' : ''}${still ? ' still' : ''}${i % 2 ? ' rev' : ''}`} tabIndex={still ? 0 : undefined} aria-label={still ? `${label}, row ${i + 1}` : undefined}>
            <div className="mq-track" style={{ '--mq-t': `${Math.round(items.length * (6 + i))}s` } as CSSProperties}>
              <ul className="mq-list">{items}</ul>
              {!still && <ul className="mq-list" aria-hidden="true" inert>{items}</ul>}
            </div>
          </div>
        ))}
      </div>
      {!still && (
        <div className="wrap st-bar">
          <button type="button" className="st-pause" onClick={() => setPaused((p) => !p)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{paused ? <path d="M8 5.5v13l11-6.5z" /> : <path d="M8 5v14M16 5v14" />}</svg>
            {paused ? 'Play' : 'Pause'}
          </button>
          <p className="st-hov">Hover to pause.</p>
        </div>
      )}
    </>
  )
}
