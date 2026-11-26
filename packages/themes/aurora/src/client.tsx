'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { A, WhatsAppIcon } from './parts'

/**
 * Phone action bar (plan/15 §8, §10.10): "Next batch 12 Jan" · WhatsApp · "Join batch". It slides up once the hero button
 * has scrolled away and hides again when the batch section comes into view (the price and the real Join button are
 * there). Phones only: the CSS shows it below 560px. While hidden its links are out of the tab order and hidden from
 * screen readers. The wrapper has no height, so the bar never pushes the page down.
 */
export function PhoneBar({ title, line, label, href, whatsapp }: { title: string; line: string; label: string; href: string; whatsapp: string | null }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const hero = document.getElementById('hero-act')
    const batch = document.getElementById('batch')
    if (!hero || !batch) return
    const check = () => setOn(hero.getBoundingClientRect().bottom < 0 && batch.getBoundingClientRect().top > innerHeight)
    check()
    addEventListener('scroll', check, { passive: true })
    addEventListener('resize', check)
    return () => { removeEventListener('scroll', check); removeEventListener('resize', check) }
  }, [])
  const tab = on ? undefined : -1
  return (
    <div className="mbar-wrap">
      <div className={`mbar${on ? ' show' : ''}`} aria-hidden={!on} inert={!on}>
        <p><b>{title}</b>{line}</p>
        {whatsapp && <a className="wa-btn" href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Ask on WhatsApp" tabIndex={tab}><WhatsAppIcon /></a>}
        <A className="btn" href={href} tabIndex={tab}>{label}</A>
      </div>
    </div>
  )
}

/**
 * The placement wall. On phones it shows the first 6 learners and a "Show all 15 learners" button (plan/15 §8: a grid with
 * "Show all", never a carousel). The cap is applied only after the page has loaded, so without JavaScript every learner
 * is visible and there is no button that does nothing.
 */
export function PlacementWall({ items, count }: { items: ReactNode[]; count: number }) {
  const [ready, setReady] = useState(false)
  const [all, setAll] = useState(false)
  useEffect(() => setReady(true), [])
  return (
    <>
      <ul className={`wall${ready && !all ? ' capped' : ''}`} id="wall">{items}</ul>
      {ready && (
        <button type="button" className="btn btn-line more" aria-expanded={all} aria-controls="wall" onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer' : `Show all ${count} learners`}
        </button>
      )}
    </>
  )
}
