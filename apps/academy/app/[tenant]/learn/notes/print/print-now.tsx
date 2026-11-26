'use client'

import { useEffect } from 'react'

/** Opens the print dialog once the page is shown. The button stays for people who close it. Hidden when printing. */
export function PrintNow() {
  useEffect(() => { const t = setTimeout(() => window.print(), 400); return () => clearTimeout(t) }, [])
  return (
    <p className="np-bar">
      <button type="button" onClick={() => window.print()}>Print or save as PDF</button>
      <span>Choose “Save as PDF” as the printer.</span>
    </p>
  )
}
