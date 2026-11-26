'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Pixels of travel in one direction before the bar reacts, so a resting thumb does not make it flicker. */
const TRAVEL = 8
/** How long scrolling is ignored after a tap on an in-page link, so the jump itself does not bring the bar back. */
const JUMP_MS = 800

/**
 * Phone navbar that gets out of the way: it hides while the visitor scrolls down and comes back on the first scroll up
 * (plan/15 §8). Wrap the bar (or bars) in it; the wrapper must be a direct child of the page shell. The CSS
 * (styles.css, `.autohide`) acts on phones only; on wider screens the wrapper has no box and nothing changes. It never
 * hides while the keyboard focus is inside it or a menu in it is open.
 */
export function AutoHide({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    // Clamped to the page, so the rubber-band bounce at either end does not count as a scroll.
    const top = () => Math.max(0, Math.min(scrollY, document.documentElement.scrollHeight - innerHeight))
    let last = top()
    let travel = 0
    let jumpUntil = 0
    const onScroll = () => {
      const y = top()
      const step = y - last
      last = y
      const height = root.current?.offsetHeight ?? 0
      if (!height || y <= height) { travel = 0; setHidden(false); return }
      if (!step || performance.now() < jumpUntil) return
      travel = Math.sign(step) === Math.sign(travel) ? travel + step : step
      if (travel > TRAVEL) setHidden(true)
      else if (travel < -TRAVEL) setHidden(false)
    }
    // "Fees" in the link row lands on the section itself, so the bar steps aside instead of covering its heading.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.('a[href*="#"]')
      if (!(a instanceof HTMLAnchorElement) || !root.current?.offsetHeight) return
      if (a.pathname !== location.pathname || a.hash.length < 2 || a.hash === '#main') return
      jumpUntil = performance.now() + JUMP_MS
      setHidden(true)
    }
    onScroll()
    addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('click', onClick)
    return () => { removeEventListener('scroll', onScroll); document.removeEventListener('click', onClick) }
  }, [])

  return <div ref={root} className="autohide" data-hidden={hidden || undefined}>{children}</div>
}
