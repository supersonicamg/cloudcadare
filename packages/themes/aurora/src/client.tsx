'use client'

import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { WhatsAppIcon } from './parts'

/**
 * Phone action bar (plan/15 §8, §10.10): a short line, WhatsApp and the page's one action (`children`). It slides up
 * once the button with id `trigger` has scrolled away and, when `until` is given, hides again while that section or
 * anything below it is on screen (on the home page the batch ticket has the price and the real Join button). Phones
 * only: the CSS (phone.css) shows it below 560px. While hidden it is inert: out of the tab order and hidden from screen
 * readers. The wrapper has no height, so the bar never pushes the page down.
 */
export function PhoneBar({ title, line, trigger, until, whatsapp, children }: { title: string; line: string; trigger: string; until?: string; whatsapp: string | null; children: ReactNode }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const check = () => {
      const start = document.getElementById(trigger)
      const end = until ? document.getElementById(until) : null
      setOn(Boolean(start && start.getBoundingClientRect().bottom < 0 && (!end || end.getBoundingClientRect().top > innerHeight)))
    }
    check()
    addEventListener('scroll', check, { passive: true })
    addEventListener('resize', check)
    return () => { removeEventListener('scroll', check); removeEventListener('resize', check) }
  }, [trigger, until])
  return (
    <div className="mbar-wrap">
      <div className={`mbar${on ? ' show' : ''}`} aria-hidden={!on} inert={!on}>
        <p><b>{title}</b>{line}</p>
        {whatsapp && <a className="wa-btn" href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Ask on WhatsApp"><WhatsAppIcon /></a>}
        {children}
      </div>
    </div>
  )
}

/** Phones, by width: the same limit as the rail styles in phone.css. */
const PHONE = '(max-width: 560px)'
const STILL = '(prefers-reduced-motion: reduce)'
/** Pixels a second: slow enough to read a card as it passes. */
const SPEED = 36
/** How long a sliding rail waits after the thumb lifts, so a swipe is never fought. */
const RESUME_MS = 2500

/**
 * A list that is a grid on wide screens and a sliding row on phones (plan/15 §8; styles in phone.css). The visitor can
 * always swipe it. With `auto` it also slides by itself on phones: the items are repeated once more so it never reaches
 * an end, it waits while a thumb is on it, and "Pause sliding" stops it (moving content must be stoppable, WCAG 2.2.2).
 * No automatic sliding with reduced motion or without JavaScript: the row is then only swiped, and nothing is repeated.
 */
export function Rail({ items, className, itemClassName, ordered, auto }: {
  items: Array<{ key: string; node: ReactNode }>; className: string; itemClassName?: string; ordered?: boolean; auto?: boolean
}) {
  const rail = useRef<HTMLElement>(null)
  const [sliding, setSliding] = useState(false)
  const [paused, setPaused] = useState(false)
  const count = items.length

  useEffect(() => {
    if (!auto) return
    const phone = matchMedia(PHONE), still = matchMedia(STILL)
    const sync = () => setSliding(phone.matches && !still.matches)
    sync()
    phone.addEventListener('change', sync)
    still.addEventListener('change', sync)
    return () => { phone.removeEventListener('change', sync); still.removeEventListener('change', sync) }
  }, [auto])

  useEffect(() => {
    const el = rail.current
    if (!el || !sliding || paused) return
    let frame = 0, before = 0, at = el.scrollLeft, held = false, waitUntil = 0, seen = false
    const tick = (now: number) => {
      const passed = before ? Math.min(now - before, 64) : 0
      before = now
      const first = el.children[0] as HTMLElement | undefined
      const again = el.children[count] as HTMLElement | undefined
      // One full round of the list. Moving by exactly this much looks identical, which is what makes the loop seamless.
      const round = first && again ? again.offsetLeft - first.offsetLeft : 0
      if (held || now < waitUntil || !round) at = el.scrollLeft
      else {
        // Stay in the middle of the repeated list, so there is room to swipe both ways.
        const low = Math.max(0, (round - el.clientWidth) / 2)
        const next = at + (passed * SPEED) / 1000 - low
        // `at` keeps the fraction: some browsers round scrollLeft, which would stall a slow slide.
        at = low + ((next % round) + round) % round
        el.scrollLeft = at
      }
      frame = requestAnimationFrame(tick)
    }
    // Runs only while the row is on screen.
    const watch = new IntersectionObserver(([entry]) => {
      const now = Boolean(entry?.isIntersecting)
      if (now === seen) return
      seen = now
      // Lazy loading does not look sideways, so a card would slide in grey: load the row's photos once it is on screen.
      if (seen) for (const img of el.querySelectorAll('img')) img.loading = 'eager'
      cancelAnimationFrame(frame)
      before = 0
      if (seen) frame = requestAnimationFrame(tick)
    })
    const hold = () => { held = true }
    const release = () => { held = false; waitUntil = performance.now() + RESUME_MS }
    const wheel = () => { waitUntil = performance.now() + RESUME_MS }
    el.addEventListener('touchstart', hold, { passive: true })
    el.addEventListener('touchend', release)
    el.addEventListener('touchcancel', release)
    el.addEventListener('wheel', wheel, { passive: true })
    watch.observe(el)
    return () => {
      cancelAnimationFrame(frame)
      watch.disconnect()
      el.removeEventListener('touchstart', hold)
      el.removeEventListener('touchend', release)
      el.removeEventListener('touchcancel', release)
      el.removeEventListener('wheel', wheel)
    }
  }, [sliding, paused, count])

  const List = ordered ? 'ol' : 'ul'
  return (
    <>
      <List ref={rail as Ref<HTMLUListElement & HTMLOListElement>} className={`rail ${className}`} data-sliding={sliding || undefined}>
        {items.map((i) => <li key={i.key} className={itemClassName}>{i.node}</li>)}
        {/* The second round exists only while sliding; screen readers hear each item once. */}
        {sliding && items.map((i) => <li key={`again-${i.key}`} className={itemClassName} aria-hidden="true">{i.node}</li>)}
      </List>
      {sliding && (
        <button type="button" className="link rail-ctl" data-paused={paused || undefined} onClick={() => setPaused((p) => !p)}>
          {paused ? 'Resume sliding' : 'Pause sliding'}
        </button>
      )}
    </>
  )
}
