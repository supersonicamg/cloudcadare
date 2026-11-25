'use client'

import { useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { WhatsAppIcon } from './parts'

function subscribeScroll(cb: () => void) {
  window.addEventListener('scroll', cb, { passive: true })
  return () => window.removeEventListener('scroll', cb)
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
