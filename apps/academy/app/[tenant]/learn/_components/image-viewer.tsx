'use client'

import { useState } from 'react'
import { Icon } from '@educore/ui/marks'

const STEPS = [1, 1.5, 2, 3]

/** A picture lesson: shown whole first, then zoom in with the plus button and scroll around. Download is one tap. */
export function ImageViewer({ src, alt, downloadHref }: { src: string; alt: string; downloadHref: string }) {
  const [at, setAt] = useState(0)
  const zoom = STEPS[at]!
  return (
    <figure className="lx-img">
      <div className="lx-img-bar" role="toolbar" aria-label="Picture controls">
        <button type="button" onClick={() => setAt(Math.max(0, at - 1))} disabled={at === 0} aria-label="Zoom out"><Icon name="minus" /></button>
        <span aria-live="polite">{zoom === 1 ? 'Fits the screen' : `${Math.round(zoom * 100)}%`}</span>
        <button type="button" onClick={() => setAt(Math.min(STEPS.length - 1, at + 1))} disabled={at === STEPS.length - 1} aria-label="Zoom in"><Icon name="plus" /></button>
        <a href={downloadHref} className="tb" download><Icon name="down" /><span>Download</span></a>
      </div>
      <div className="lx-img-scroll" data-zoomed={zoom > 1 ? 'true' : 'false'}>
        {/* A lesson image behind a permission check and a short-lived link: the next/image optimiser cannot fetch it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} style={zoom > 1 ? { width: `${zoom * 100}%`, maxWidth: 'none' } : undefined} />
      </div>
    </figure>
  )
}
