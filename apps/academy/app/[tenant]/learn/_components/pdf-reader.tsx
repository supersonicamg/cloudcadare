'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { Ic } from '../../_components/v11'
import { useStage } from './stage'

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

let lib: Promise<PdfJs> | null = null
/** pdf.js is large: it is fetched only when a learner opens a PDF lesson. The "legacy" build also runs on older phones. */
function loadPdfJs(): Promise<PdfJs> {
  lib ??= import('pdfjs-dist/legacy/build/pdf.mjs').then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString()
    return m
  })
  return lib
}

const ZOOMS = [0.6, 0.8, 1, 1.25, 1.5, 2, 2.5]

/**
 * A PDF reader made for studying: pages scroll like a document, the page counter follows the reader, the arrows and the
 * page box jump, zoom is one tap, and text can be selected and saved as a highlight. Each note is stamped with the page
 * the learner is on. If the file cannot be drawn here (an old browser, a blocked file), the browser's own viewer takes over.
 */
export function PdfReader({ src, title }: { src: string; title: string }) {
  const stage = useStage()
  const { page, pageCount, setPage, setPageCount, goTo, jumpTick, add, enabled } = stage
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [zoomAt, setZoomAt] = useState(2)
  const [width, setWidth] = useState(0)
  const [ratio, setRatio] = useState(1.414)
  const [typed, setTyped] = useState<string | null>(null)
  const [picked, setPicked] = useState<{ text: string; page: number } | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [full, setFull] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const lastJump = useRef(0)
  const zoom = ZOOMS[zoomAt]!

  // Open the file.
  useEffect(() => {
    let dead = false
    let task: { destroy(): Promise<void> } | null = null
    void (async () => {
      try {
        const pdfjs = await loadPdfJs()
        const loading = pdfjs.getDocument({ url: src })
        task = loading
        const opened = await loading.promise
        if (dead) return
        const first = await opened.getPage(1)
        const v = first.getViewport({ scale: 1 })
        setRatio(v.height / v.width)
        setDoc(opened)
        setPageCount(opened.numPages)
        setStatus('ready')
      } catch {
        if (!dead) setStatus('error')
      }
    })()
    // Destroying the loading task also closes the document and stops its worker.
    return () => { dead = true; void task?.destroy() }
  }, [src, setPageCount])

  // The page width follows the box, so a phone turned sideways, or a closed side panel, redraws sharply.
  useEffect(() => {
    const el = scroller.current
    if (!el || status !== 'ready') return
    const read = () => setWidth(Math.max(240, Math.floor(el.clientWidth - 24)))
    read()
    let t: ReturnType<typeof setTimeout> | undefined
    const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(read, 150) })
    ro.observe(el)
    return () => { clearTimeout(t); ro.disconnect() }
  }, [status])

  const pageWidth = Math.round(width * zoom)
  const pageHeight = Math.round(pageWidth * ratio)
  const GAP = 14

  // Which page is on screen: the one that covers the line a third of the way down the box.
  const track = useCallback(() => {
    const el = scroller.current
    if (!el || !pageHeight) return
    const n = Math.min(pageCount || 1, Math.max(1, Math.floor((el.scrollTop + el.clientHeight * 0.33 - 12) / (pageHeight + GAP)) + 1))
    setPage(n)
  }, [pageHeight, pageCount, setPage])
  useEffect(() => {
    const el = scroller.current
    if (!el || status !== 'ready') return
    let raf = 0
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(track) }
    el.addEventListener('scroll', on, { passive: true })
    return () => { el.removeEventListener('scroll', on); cancelAnimationFrame(raf) }
  }, [track, status])

  // A page button, a page box or a note asks to go to a page.
  useEffect(() => {
    const el = scroller.current
    if (!el || status !== 'ready' || !pageHeight || jumpTick === lastJump.current) return
    lastJump.current = jumpTick
    el.scrollTo({ top: (Math.min(Math.max(page, 1), pageCount || 1) - 1) * (pageHeight + GAP), behavior: 'auto' })
  }, [jumpTick, page, pageCount, pageHeight, status])

  // Keep the same place when the zoom changes.
  const changeZoom = (next: number) => {
    const el = scroller.current
    const at = Math.min(Math.max(next, 0), ZOOMS.length - 1)
    if (!el || at === zoomAt) return
    const frac = el.scrollTop / ((pageHeight + GAP) * (pageCount || 1))
    setZoomAt(at)
    requestAnimationFrame(() => requestAnimationFrame(() => { el.scrollTop = frac * ((Math.round(width * ZOOMS[at]! * ratio) + GAP) * (pageCount || 1)) }))
  }

  // Selected text can be saved as a highlight (needs notes switched on and a learner who is enrolled).
  useEffect(() => {
    if (!enabled) return
    const onSel = () => {
      const sel = window.getSelection()
      const text = sel?.toString().replace(/\s+/g, ' ').trim() ?? ''
      const node = sel?.anchorNode instanceof Element ? sel.anchorNode : sel?.anchorNode?.parentElement
      const wrap = node?.closest('[data-n]') as HTMLElement | null
      if (text.length > 1 && wrap && scroller.current?.contains(wrap)) setPicked({ text: text.slice(0, 1500), page: Number(wrap.dataset.n) })
      else setPicked(null)
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [enabled])
  const saveHighlight = async () => {
    if (!picked) return
    const err = await add('highlight', picked.text, { seconds: null, page: picked.page })
    setSavedMsg(err ?? `Highlight saved from page ${picked.page}.`)
    if (!err) { setPicked(null); window.getSelection()?.removeAllRanges() }
    setTimeout(() => setSavedMsg(null), 3000)
  }

  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === box.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])
  // Full screen is offered only where the browser has it (not on iPhones). Decided after the first paint so the server and browser agree.
  const [canFull, setCanFull] = useState(false)
  useEffect(() => { const t = setTimeout(() => setCanFull(document.fullscreenEnabled), 0); return () => clearTimeout(t) }, [])

  if (status === 'error') {
    // No fallback to the browser's own viewer: it comes with a download button.
    return (
      <div className="pdfr-fallback">
        <p className="note-l"><Ic n="info" s /><span>This file could not be opened here. Refresh the page, or try another browser.</span></p>
      </div>
    )
  }

  const go = (n: number) => goTo(Math.min(Math.max(Math.round(n) || 1, 1), pageCount || 1))
  return (
    <div className="pdfr" ref={box}>
      <div className="tbar" role="toolbar" aria-label="PDF controls">
        <div className="grp">
          <button type="button" onClick={() => go(page - 1)} disabled={status !== 'ready' || page <= 1} aria-label="Previous page"><Ic n="back" /></button>
          <label>
            <span className="sr">Page number</span>
            <input inputMode="numeric" value={typed ?? String(page)} aria-label={`Page, of ${pageCount}`}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setTyped(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onBlur={() => { if (typed) go(Number(typed)); setTyped(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur() } }} />
          </label>
          <span className="of t-small tnum">of {pageCount || '…'}</span>
          <button type="button" onClick={() => go(page + 1)} disabled={status !== 'ready' || page >= pageCount} aria-label="Next page"><Ic n="chev" /></button>
        </div>
        <div className="grp">
          <button type="button" onClick={() => changeZoom(zoomAt - 1)} disabled={zoomAt === 0} aria-label="Zoom out">−</button>
          <span className="zv t-small tnum" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => changeZoom(zoomAt + 1)} disabled={zoomAt === ZOOMS.length - 1} aria-label="Zoom in">+</button>
        </div>
        <div className="grp more">
          {canFull && <button type="button" className="tb" onClick={() => { if (full) void document.exitFullscreen(); else void box.current?.requestFullscreen() }}><Ic n="full" s /><span>{full ? 'Exit full screen' : 'Full screen'}</span></button>}
        </div>
      </div>

      {(picked || savedMsg) && (
        <div className="pdfr-pick" role="status">
          {picked ? <>
            <span className="q t-small">“{picked.text.length > 90 ? `${picked.text.slice(0, 90)}…` : picked.text}”</span>
            <button type="button" className="btn btn-line btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={() => void saveHighlight()}><Ic n="hl" s />Save as highlight</button>
          </> : <span className="ok-line"><Ic n="check" s />{savedMsg}</span>}
        </div>
      )}

      <div className="pdfr-scroll" ref={scroller} onContextMenu={(e) => e.preventDefault()} tabIndex={0} role="document" aria-label={`${title}. Use the arrow keys to scroll.`}
        onKeyDown={(e) => {
          const t = e.target as HTMLElement
          if (t.tagName === 'INPUT') return
          if (e.key === 'ArrowRight' && zoom <= 1) { e.preventDefault(); go(page + 1) }
          if (e.key === 'ArrowLeft' && zoom <= 1) { e.preventDefault(); go(page - 1) }
        }}>
        {status === 'loading' && <p className="pdfr-load t-small" role="status">Opening the PDF…</p>}
        {status === 'ready' && doc && width > 0 && (
          <div className="pdfr-pages" style={{ width: pageWidth, gap: GAP }}>
            {Array.from({ length: doc.numPages }, (_, i) => <PdfPage key={i} doc={doc} n={i + 1} width={pageWidth} height={pageHeight} root={scroller} />)}
          </div>
        )}
      </div>
    </div>
  )
}

/** One page. It is drawn only while it is close to the screen, and wiped when it is far, so a 200-page file stays light. */
function PdfPage({ doc, n, width, height, root }: { doc: PDFDocumentProxy; n: number; width: number; height: number; root: React.RefObject<HTMLDivElement | null> }) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const text = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(n <= 2)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setNear(Boolean(e?.isIntersecting)), { root: root.current, rootMargin: '1400px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [root])

  useEffect(() => {
    const c = canvas.current, t = text.current
    if (!c || !t) return
    if (!near) { c.width = 0; c.height = 0; t.replaceChildren(); return }
    let dead = false
    let task: { cancel(): void; promise: Promise<unknown> } | null = null
    void (async () => {
      try {
        const pdfjs = await loadPdfJs()
        const p = await doc.getPage(n)
        if (dead) return
        const viewport = p.getViewport({ scale: width / p.getViewport({ scale: 1 }).width })
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        c.width = Math.floor(viewport.width * dpr)
        c.height = Math.floor(viewport.height * dpr)
        const ctx = c.getContext('2d')
        if (!ctx) return
        task = p.render({ canvas: c, canvasContext: ctx, viewport, transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0] })
        await task.promise
        if (dead) return
        t.replaceChildren()
        t.style.setProperty('--total-scale-factor', String(viewport.scale))
        const layer = new pdfjs.TextLayer({ textContentSource: p.streamTextContent(), container: t, viewport })
        await layer.render()
      } catch { /* a cancelled draw (the page scrolled away or was resized) is not an error */ }
    })()
    return () => { dead = true; task?.cancel() }
  }, [doc, n, width, near])

  return (
    <div className="pdfr-page" ref={wrap} data-n={n} style={{ width, height, '--scale-round-x': '1px', '--scale-round-y': '1px' } as React.CSSProperties}
      role="group" aria-label={`Page ${n}`}>
      <canvas ref={canvas} aria-hidden="true" style={{ width, height }} />
      <div className="textLayer" ref={text} />
    </div>
  )
}
