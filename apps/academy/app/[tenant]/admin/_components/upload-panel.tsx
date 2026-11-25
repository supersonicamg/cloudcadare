'use client'

import { useState, type ReactNode } from 'react'
import { Icon } from '@educore/ui/marks'

/**
 * "Upload videos" under a month. It starts open for an empty month and then belongs to the person: the page refreshes
 * after each file, and a month that is no longer empty must not close over the uploads still running.
 */
export function UploadPanel({ startOpen, children }: { startOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(startOpen)
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="inline-flex h-11 cursor-pointer list-none items-center gap-2 rounded-[10px] border-2 border-primary px-4 text-[15px] font-semibold text-primary hover:bg-[#E4EFEB]">
        <Icon name="video" className="h-5 w-5" /> Upload videos
      </summary>
      <div className="mt-4 rounded-2xl bg-muted p-4">{children}</div>
    </details>
  )
}
