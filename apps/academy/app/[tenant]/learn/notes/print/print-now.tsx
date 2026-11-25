'use client'

import { useEffect } from 'react'

/** Opens the print dialog once the page is shown. The button stays for people who close it. Hidden when printing. */
export function PrintNow() {
  useEffect(() => { const t = setTimeout(() => window.print(), 400); return () => clearTimeout(t) }, [])
  return (
    <p className="mb-6 flex items-center gap-4 print:hidden">
      <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center rounded-[10px] border-2 border-fg px-[18px] text-[15px] font-semibold hover:bg-muted">Print or save as PDF</button>
      <span className="t-small">Choose “Save as PDF” as the printer.</span>
    </p>
  )
}
