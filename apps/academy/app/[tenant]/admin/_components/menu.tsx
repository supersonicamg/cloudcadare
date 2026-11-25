'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/** The three dots. Not in the shared icon set because nothing else needs it. */
function Dots() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <circle cx="5.5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="18.5" cy="12" r="1.9" />
    </svg>
  )
}

/**
 * A small "more" menu. Uses a native <details>, so it works before the page hydrates; this only adds what the
 * browser does not: it closes on an outside click, on Escape, and after one of its forms is sent.
 */
export function Menu({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  const box = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const close = () => { if (box.current) box.current.open = false }
    const outside = (e: PointerEvent) => { if (box.current?.open && !box.current.contains(e.target as Node)) close() }
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !box.current?.open) return
      close()
      box.current.querySelector('summary')?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [])

  return (
    <details ref={box} className="group relative">
      <summary aria-label={label} title={label}
        className="grid size-11 cursor-pointer list-none place-items-center rounded-[10px] text-mute hover:bg-muted hover:text-fg group-open:bg-muted group-open:text-fg [&::-webkit-details-marker]:hidden">
        <Dots />
      </summary>
      {/* Closed a tick later so the browser still sends the form that was just pressed. */}
      <div onSubmit={() => setTimeout(() => { if (box.current) box.current.open = false }, 0)}
        className={`absolute right-0 z-30 mt-1 rounded-2xl bg-white p-2 shadow-[0_8px_24px_rgba(20,32,31,.18)] ring-1 ring-border ${wide ? 'w-[min(22rem,calc(100vw-2rem))]' : 'w-64'}`}>
        {children}
      </div>
    </details>
  )
}
