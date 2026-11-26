'use client'

import { useState, type ReactNode } from 'react'

/**
 * The recordings grid (children are the `<li>`s). On a phone it shows the first four and a "Show all N recordings"
 * button (guide §8: a grid with show all, no swipe row). The limit is a CSS rule on `.recs.lim`, so on wider screens
 * everything shows and the button stays hidden.
 */
export function RecList({ count, children }: { count: number; children: ReactNode }) {
  const [all, setAll] = useState(false)
  const limited = count > 4
  return (
    <>
      <ul className={`recs${limited ? ' lim' : ''}${all ? ' all' : ''}`} id="recs">{children}</ul>
      {limited && (
        <button type="button" className="btn btn-line more-b ph" aria-expanded={all} aria-controls="recs" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${count} recordings`}
        </button>
      )}
    </>
  )
}
